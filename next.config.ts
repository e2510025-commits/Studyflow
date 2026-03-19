import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Cloudflare Pages: avoid server-side image optimization invocations.
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "studyflow.studio",
      },
      {
        protocol: "https",
        hostname: "cdn.studyflow.studio",
      },
    ],
  },
  // Reduce bundle size for icon-heavy client components.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  telemetry: false,
  silent: true,
  tunnelRoute: "/monitoring",
  widenClientFileUpload: true,
});
