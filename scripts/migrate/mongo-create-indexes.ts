import "dotenv/config";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "";

if (!MONGODB_URI) {
  throw new Error("Missing MONGODB_URI");
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error("Mongo DB connection missing");

  await db.collection("users").createIndex({ email: 1 }, { background: true });
  await db.collection("userProfiles").createIndex({ uid: 1 }, { background: true, unique: false });
  await db.collection("userProfiles").createIndex({ name: 1 }, { background: true });
  await db.collection("studyLogs").createIndex({ userUid: 1, createdAt: -1 }, { background: true });
  await db.collection("timelinePosts").createIndex({ uid: 1, createdAt: -1 }, { background: true });
  await db.collection("timelinePosts").createIndex({ createdAt: -1 }, { background: true });

  console.log("Mongo indexes created successfully");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Index creation failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
