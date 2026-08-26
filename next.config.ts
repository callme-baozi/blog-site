import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 is a native module, must not be bundled by webpack
  serverExternalPackages: ["better-sqlite3"],
  // Allow large file uploads (videos up to 200MB)
  experimental: {},
};

export default nextConfig;
