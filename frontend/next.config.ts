// --- v3-app/frontend/next.config.ts ---
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone', 
  serverExternalPackages: ['sharp'],
  
  async rewrites() {
    return [
      {
        source: '/ws/:path*',
        // ビルド時は 'http://localhost:8000' が使われ、Azure実行時は環境変数が上書きします
        destination: `${process.env.BACKEND_URL || 'http://localhost:8000'}/ws/:path*`,
      },
    ];
  },
};

export default nextConfig;