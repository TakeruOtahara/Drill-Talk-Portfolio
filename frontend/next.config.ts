// --- v3-app/frontend/next.config.ts ---
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone', 
  serverExternalPackages: ['sharp'],
  
  // 💡 追加: 実際のWebSocket通信（Upgradeヘッダー必須）の横流しは、
  // MiddlewareではなくNext.js本体のコア機能（Node.js環境）で行う
  async rewrites() {
    return [
      {
        source: '/ws/:path*',
        // Azureのコンテナ環境変数 BACKEND_URL を読み込んでプロキシ
        destination: `${process.env.BACKEND_URL}/ws/:path*`,
      },
    ];
  },
};

export default nextConfig;