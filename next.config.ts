import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't generate AGENTS.md / CLAUDE.md in the project root.
  agentRules: false,
  output: "export",
  trailingSlash: true,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
