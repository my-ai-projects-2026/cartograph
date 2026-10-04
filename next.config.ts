import type { NextConfig } from "next";
// Validates required environment variables when the server boots.
import "./src/env";

const nextConfig: NextConfig = {
  reactCompiler: true,
};

export default nextConfig;
