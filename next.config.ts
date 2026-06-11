import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "pdf-parse"],
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**", "./src/data/market/**"],
  },
};

export default nextConfig;
