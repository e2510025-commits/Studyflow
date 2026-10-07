import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [{
      source: "/:path*",
      has: [{ type: "host", value: "studyflow-lake\\.vercel\\.app" }],
      destination: "https://studyflow.studio/:path*",
      permanent: false,
    }];
  },
  images: {
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

export default nextConfig;
