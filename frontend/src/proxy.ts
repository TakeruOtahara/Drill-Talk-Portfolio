// --- v3-app/frontend/src/proxy.ts ---
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // /ws/ から始まるWebSocketリクエストを検知
  if (request.nextUrl.pathname.startsWith('/ws/')) {
    
    // 🛡️ 1. CSWSH対策: Origin (アクセス元) の厳格チェック
    const origin = request.headers.get('origin');
    const allowedOriginsRaw = process.env.ALLOWED_ORIGINS_RAW || 'http://localhost:3000';
    const allowedOrigins = allowedOriginsRaw.split(',').map(o => o.trim());

    // Originが存在しない、または許可リストにない場合は 403 Forbidden で即時切断
    if (!origin || !allowedOrigins.includes(origin)) {
      console.warn(`🚫 CSWSH Blocked: Invalid Origin - ${origin}`);
      return new NextResponse('Forbidden: Invalid Origin', { status: 403 });
    }

    // --- ここから下は正規のアクセスのみ到達できる ---

    const apiKey = process.env.DRILLTALK_API_KEY;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

    // 2. リクエストヘッダーを複製し、通行証を注入
    const requestHeaders = new Headers(request.headers);
    if (apiKey) {
        // 一般的なカスタムヘッダーの形式（X-）を使用
        requestHeaders.set('X-DrillTalk-Key', apiKey);
    }

    // 3. APIMのURLに向けて通信を横流し（Rewrite）
    const targetUrl = new URL(request.nextUrl.pathname, backendUrl);
    return NextResponse.rewrite(targetUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/ws/:path*',
};