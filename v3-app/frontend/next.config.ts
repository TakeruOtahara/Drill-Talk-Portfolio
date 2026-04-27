import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Dockerコンテナ内でのビルドサイズと実行速度を最適化
  output: 'standalone', 
  // node_modules の中にある資産（Sharpなど）を正しく扱う
  serverExternalPackages: ['sharp'],

  // 💡 スマホ（ngrok）からの WebSocket 通信をバックエンドに転送する設定
  async rewrites() {
    // 💡 環境変数があればそれを使用し、なければデフォルトで Docker 内部用URLを使う
    const backendUrl = process.env.BACKEND_INTERNAL_URL || 'http://backend:8000';

    return [
      {
        source: '/ws/:path*',
        // 🛡️ ハードコードを排除し、変数化
        destination: `${backendUrl}/ws/:path*`,
      },
    ];
  },
};

export default nextConfig;