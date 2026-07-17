import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Turbopack configuration (required for Next.js 16)
  turbopack: {
    root: process.cwd(),
  },
  // Reduce parallel builds to save memory
  experimental: {
    // Reduce memory pressure during static optimization
    parallelServerCompiles: false,
  },
};

export default nextConfig;