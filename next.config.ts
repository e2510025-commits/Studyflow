import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

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

initOpenNextCloudflareForDev();

export default nextConfig;
