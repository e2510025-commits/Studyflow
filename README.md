This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Cloudflare Pages

This project is configured for Cloudflare Pages with [`@cloudflare/next-on-pages`](https://github.com/cloudflare/next-on-pages).

### Build for Pages

```bash
npm run build:pages
```

This produces the Pages output in `.vercel/output/static`.

### Deploy from local CLI

```bash
npm run deploy:pages -- --project-name <your-pages-project-name>
```

### Cloudflare Pages Dashboard build settings

- Build command: `npm run build:pages`
- Build output directory: `.vercel/output/static`

Set your required environment variables in the Pages project settings before deploying.

### Note for Windows local builds

`@cloudflare/next-on-pages` is known to be unreliable on native Windows shells.
If local `npm run build:pages` fails on Windows, run it in WSL or rely on Cloudflare Pages CI (Linux) for the production build.

### Runtime strategy (Edge + Node)

- Most `src/app/api/**/route.ts` handlers are configured with `export const runtime = "edge"`.
- Auth handlers that depend on `bcryptjs` stay on Node runtime:
	- `src/app/api/auth/[...nextauth]/route.ts`
	- `src/app/api/auth/register/route.ts`
- Email verification hashing routes are edge-compatible (`crypto.subtle`):
	- `src/app/api/auth/register/send-code/route.ts`
	- `src/app/api/auth/register/verify-code/route.ts`

### Applied API optimizations

- `src/app/api/ranking/route.ts`
	- Added response caching headers.
	- Added short-lived in-isolate profile cache to reduce repeated Firestore profile reads.
- `src/app/api/admin/overview/route.ts`, `src/app/api/admin/users/route.ts`, `src/app/api/support/route.ts`, `src/app/api/missions/route.ts`
	- Added private cache headers for repeated dashboard/session polling traffic.
- `src/app/api/calendar/export/route.ts`
	- Changed from `no-store` to `private, max-age=300` to reduce repeated export load.

### Image optimization (R2 + client compression)

Images selected in these UIs are compressed in the browser before upload and sent to Cloudflare R2 via pre-signed URL:

- `src/app/global-chat/page.tsx`
- `src/app/timeline/page.tsx`
- `src/app/profile/[uid]/page.tsx`

Compression policy:

- Max file size: 300KB
- Max long edge: 1200px
- Library: `browser-image-compression`

Server endpoint:

- `POST /api/uploads/r2/presign`
- File: `src/app/api/uploads/r2/presign/route.ts`

Required env vars:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`

R2 bucket CORS must allow `PUT` from your site origin for browser uploads.

## MongoDB Atlas migration design (Firestore-compatible)

This repository now includes a parallel MongoDB layer that keeps Firestore-style collection names and IDs.

### 1) Mongo connection and models

- Connection: `src/lib/mongo/client.ts`
- Schemas (Mongoose):
	- `src/lib/mongo/models/user.model.ts`
	- `src/lib/mongo/models/userProfile.model.ts`
	- `src/lib/mongo/models/studyLog.model.ts`
	- `src/lib/mongo/models/timelinePost.model.ts`

All schemas use Firestore document IDs as `_id` (string) so existing references can be preserved.

### 2) Next.js CRUD routes (Mongo)

- Users collection:
	- `GET/POST /api/mongo/users`
	- `GET/PATCH/DELETE /api/mongo/users/[uid]`
- Timeline posts:
	- `GET/POST /api/mongo/timeline`

### 3) Existing data migration (Firestore -> Mongo)

Script:

- `scripts/migrate/firestore-to-mongodb.ts`

Behavior:

- Migrates every root Firestore collection.
- Preserves document IDs as `_id`.
- Converts Firestore `Timestamp` to `Date`.
- Preserves nested subcollections in `__subcollections`.
- Upsert-safe (re-runnable).

Run:

```bash
npm run migrate:firestore:mongo
npm run mongo:indexes
```

### 4) Required env vars for migration

- `MONGODB_URI`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

## Monitoring and analytics setup

### Simple Analytics

- Script is injected from `src/app/layout.tsx`.
- Enabled only when `NEXT_PUBLIC_SIMPLE_ANALYTICS_ENABLED=true`.
- Optional custom domain support via `NEXT_PUBLIC_SIMPLE_ANALYTICS_DOMAIN`.

### Sentry (Next.js)

Added files:

- `instrumentation.ts`
- `instrumentation-client.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`

Next config integration:

- `next.config.ts` now uses `withSentryConfig(...)`.
- Upload tunnel route is set to `/monitoring`.

Required env vars:

- Runtime capture:
	- `NEXT_PUBLIC_SENTRY_DSN`
	- `SENTRY_DSN`
- Sampling:
	- `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`
	- `NEXT_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE`
	- `NEXT_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE`
	- `SENTRY_TRACES_SAMPLE_RATE`
- Build-time source map upload (recommended):
	- `SENTRY_ORG`
	- `SENTRY_PROJECT`
	- `SENTRY_AUTH_TOKEN`
