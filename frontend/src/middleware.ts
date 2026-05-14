// --- v3-app/frontend/src/middleware.ts ---
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // /ws/ から始まるWebSocketリクエストを検知
  if (request.nextUrl.pathname.startsWith('/ws/')) {
    
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');

    // 💡 1. 自身のドメイン（ACAのURL）からのアクセスかを動的に判定
    const isSameOrigin = origin && host && origin.replace(/^https?:\/\//, '') === host;

    const allowedOriginsRaw = process.env.ALLOWED_ORIGINS_RAW || 'http://localhost:3000';
    const allowedOrigins = allowedOriginsRaw.split(',').map(o => o.trim());
    const isAllowedExternal = origin && allowedOrigins.includes(origin);

    // 🛡️ 2. 防犯ゲート：不正な外部アクセスのみ弾く
    if (!isSameOrigin && !isAllowedExternal && origin !== 'null') {
      console.warn(`🚫 CSWSH Blocked: Invalid Origin - ${origin}`);
      return new NextResponse('Forbidden: Invalid Origin', { status: 403 });
    }

    const apiKey = process.env.DRILLTALK_API_KEY;
    const requestHeaders = new Headers(request.headers);
    if (apiKey) {
        requestHeaders.set('X-DrillTalk-Key', apiKey);
    }

    // 🚀 3. 【究極の修正】ここで横流し(rewrite)するとWebSocketが死ぬ！
    // 認証ヘッダーだけを付与して「奥の next.config.ts へ通す（next）」のが大正解
    return NextResponse.next({
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