// --- v3-app/frontend/next.config.ts ---
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Dockerコンテナ内でのビルドサイズと実行速度を最適化
  output: 'standalone', 
  // node_modules の中にある資産（Sharpなど）を正しく扱う
  serverExternalPackages: ['sharp'],
};

export default nextConfig;