import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone', 
  serverExternalPackages: ['sharp'],
};

export default nextConfig;