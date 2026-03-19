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
