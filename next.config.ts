import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
};

export default nextConfig;
