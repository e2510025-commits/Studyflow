import "dotenv/config";
import admin from "firebase-admin";
import mongoose from "mongoose";

type PlainObject = Record<string, unknown>;

const MONGODB_URI = process.env.MONGODB_URI || "";
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || "";
const FIREBASE_PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI");
}

if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
  throw new Error(
    "Missing Firebase Admin envs: FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY"
  );
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: FIREBASE_PROJECT_ID,
      clientEmail: FIREBASE_CLIENT_EMAIL,
      privateKey: FIREBASE_PRIVATE_KEY,
    }),
  });
}

const firestore = admin.firestore();

function sanitizeCollectionName(name: string) {
  return name.replace(/\//g, "__");
}

function toPlain(value: unknown): unknown {
  if (value == null) return value;

  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate();
  }

  if (value instanceof admin.firestore.GeoPoint) {
    return { lat: value.latitude, lng: value.longitude };
  }

  if (value instanceof admin.firestore.DocumentReference) {
    return { __ref: value.path };
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(toPlain);
  }

  if (typeof value === "object") {
    const out: PlainObject = {};
    for (const [k, v] of Object.entries(value as PlainObject)) {
      out[k] = toPlain(v);
    }
    return out;
  }

  return value;
}

async function readSubcollections(ref: FirebaseFirestore.DocumentReference) {
  const subcollections = await ref.listCollections();
  if (subcollections.length === 0) return {};

  const result: Record<string, unknown[]> = {};

  for (const sub of subcollections) {
    const snap = await sub.get();
    const docs: unknown[] = [];

    for (const row of snap.docs) {
      const nested = await readSubcollections(row.ref);
      const converted = (toPlain(row.data()) as PlainObject) || {};
      docs.push({
        _id: row.id,
        ...converted,
        __subcollections: nested,
      });
    }

    result[sub.id] = docs;
  }

  return result;
}

async function migrateCollection(col: FirebaseFirestore.CollectionReference) {
  const targetName = sanitizeCollectionName(col.path);
  const mongoCollection = mongoose.connection.db!.collection(targetName);

  const snap = await col.get();
  if (snap.empty) {
    console.log(`[skip] ${col.path} (0 docs)`);
    return;
  }

  const operations: Array<Record<string, unknown>> = [];
  let count = 0;

  for (const row of snap.docs) {
    const nested = await readSubcollections(row.ref);
    const payload: PlainObject = {
      _id: row.id,
      ...((toPlain(row.data()) as PlainObject) || {}),
      __firestorePath: row.ref.path,
      __subcollections: nested,
      __migratedAt: new Date(),
    };

    operations.push({
      replaceOne: {
        filter: { _id: row.id },
        replacement: payload,
        upsert: true,
      },
    });

    count += 1;
    if (operations.length >= 300) {
      await mongoCollection.bulkWrite(operations as never, { ordered: false });
      operations.length = 0;
    }
  }

  if (operations.length > 0) {
    await mongoCollection.bulkWrite(operations as never, { ordered: false });
  }

  console.log(`[done] ${col.path} -> ${targetName} (${count} docs)`);
}

async function main() {
  console.log("Starting Firestore -> MongoDB migration...");

  await mongoose.connect(MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 20000,
  });

  const rootCollections = await firestore.listCollections();
  console.log(`Found ${rootCollections.length} root collections`);

  for (const col of rootCollections) {
    await migrateCollection(col);
  }

  console.log("Migration completed.");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Migration failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
