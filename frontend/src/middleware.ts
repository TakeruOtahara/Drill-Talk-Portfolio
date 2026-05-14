// --- v3-app/frontend/src/middleware.ts ---
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/ws/')) {
    
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    const isSameOrigin = origin && host && origin.replace(/^https?:\/\//, '') === host;

    const allowedOriginsRaw = process.env.ALLOWED_ORIGINS_RAW || 'http://localhost:3000';
    const allowedOrigins = allowedOriginsRaw.split(',').map(o => o.trim());
    const isAllowedExternal = origin && allowedOrigins.includes(origin);

    // 💡 修正ポイント：ヘッダーが欠落している（!origin）か、
    // 疎通確認Ping（origin === 'null'）の場合は、CSWSHの危険性がない「安全なリクエスト」と定義
    const isSafeOrPing = !origin || origin === 'null';

    // 🛡️ 防犯ゲート：身内でもなく、外部許可リストでもなく、かつ安全なリクエストでもない場合のみブロック
    if (!isSameOrigin && !isAllowedExternal && !isSafeOrPing) {
      console.warn(`🚫 CSWSH Blocked: Invalid Origin - ${origin}`);
      return new NextResponse('Forbidden: Invalid Origin', { status: 403 });
    }

    const apiKey = process.env.DRILLTALK_API_KEY;
    const requestHeaders = new Headers(request.headers);
    if (apiKey) {
        requestHeaders.set('X-DrillTalk-Key', apiKey);
    }

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