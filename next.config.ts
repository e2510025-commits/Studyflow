import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
