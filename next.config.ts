import type { NextConfig } from "next";

const outputMode = process.env.NEXT_OUTPUT_MODE;

const nextConfig: NextConfig = {
  ...(outputMode === "export" ? { output: "export" as const } : {}),
  experimental: {
    typedRoutes: true
  }
};

export default nextConfig;
