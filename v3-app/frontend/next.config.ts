import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Dockerコンテナ内でのビルドサイズと実行速度を最適化
  output: 'standalone', 
  // node_modules の中にある資産（Sharpなど）を正しく扱う
  serverExternalPackages: ['sharp'],

  // 💡 スマホ（ngrok）からの WebSocket 通信をバックエンドに転送する設定
  async rewrites() {
    return [
      {
        // フロントエンドへの /ws/... へのアクセスを、バックエンド(8000番)へ転送
        source: '/ws/:path*',
        // Docker Compose を使用している場合は 'http://backend:8000/ws/:path*'
        // ローカル実行の場合は 'http://127.0.0.1:8000/ws/:path*'
        destination: 'http://backend:8000/ws/:path*',
      },
    ];
  },
};

export default nextConfig;