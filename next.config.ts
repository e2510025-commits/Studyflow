import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages: avoid server-side image optimization invocations.
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
    ],
  },
  // Reduce bundle size for icon-heavy client components.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
