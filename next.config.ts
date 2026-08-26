import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't generate AGENTS.md / CLAUDE.md in the project root.
  agentRules: false,
};

export default nextConfig;
