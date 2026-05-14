// --- v3-app/frontend/src/middleware.ts ---
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 💡 関数名を proxy から middleware に変更
export function middleware(request: NextRequest) {
  // /ws/ から始まるWebSocketリクエストを検知
  if (request.nextUrl.pathname.startsWith('/ws/')) {
    
    const origin = request.headers.get('origin');
    const host = request.headers.get('host'); // 例: aca-drilltalk-prod-frontend...

    // 💡 変更点1：自分自身のドメイン（Azure上のURL）からのアクセスかを動的に判定
    // originの 'https://' や 'http://' を取り除いて、hostヘッダーと一致するか確認します
    const isSameOrigin = origin && host && origin.replace(/^https?:\/\//, '') === host;

    const allowedOriginsRaw = process.env.ALLOWED_ORIGINS_RAW || 'http://localhost:3000';
    const allowedOrigins = allowedOriginsRaw.split(',').map(o => o.trim());
    const isAllowedExternal = origin && allowedOrigins.includes(origin);

    // 🛡️ 変更点2：防犯ゲートの判定を賢くする
    // 「身内（isSameOrigin）」でもなく、「許可リスト（isAllowedExternal）」にもなく、
    // かつ「内部の生存確認（origin === 'null'）」でもない怪しいアクセスだけを弾く
    if (!isSameOrigin && !isAllowedExternal && origin !== 'null') {
      console.warn(`🚫 CSWSH Blocked: Invalid Origin - ${origin}`);
      return new NextResponse('Forbidden: Invalid Origin', { status: 403 });
    }

    // --- ここから下はあなたの完璧なコードのままです ---

    const apiKey = process.env.DRILLTALK_API_KEY;
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';

    // 2. リクエストヘッダーを複製し、通行証を注入
    const requestHeaders = new Headers(request.headers);
    if (apiKey) {
        // 一般的なカスタムヘッダーの形式（X-）を使用
        requestHeaders.set('X-DrillTalk-Key', apiKey);
    }

    // 3. 内部バックエンド（FastAPIのInternal Ingress）に向けて通信を横流し（Rewrite）
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