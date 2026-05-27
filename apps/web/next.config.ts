import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow importing TypeScript source files from workspace packages
  // without a separate build step during development
  transpilePackages: ['@upasthiti/database', '@upasthiti/common'],
  experimental: {
    // Enables proper resolution of workspace packages
    externalDir: true,
  },
};

export default nextConfig;
