import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep pdf-parse in Node.js — don't bundle it through webpack/turbopack
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
