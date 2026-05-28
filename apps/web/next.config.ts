import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow importing TypeScript source files from workspace packages
  // without a separate build step during development
  transpilePackages: ['@upasthiti/database', '@upasthiti/common'],
  experimental: {
    // Enables proper resolution of workspace packages
    externalDir: true,
  },
  // Allow mobile devices on the local network to access the dev server.
  // Next.js 16+ blocks cross-origin dev requests by default.
  // This covers all devices on the 192.168.0.x subnet (your home/office LAN).
  allowedDevOrigins: [
    '192.168.0.169',   // Android phone (current IP — update if it changes)
    '192.168.0.*',     // any device on the same subnet
    '192.168.1.*',     // common alternate router subnet
  ],
};

export default nextConfig;
