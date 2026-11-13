import { NextRequest, NextResponse } from 'next/server';
export function middleware(req: NextRequest) {
  if (process.env.AUTH_ENABLED === 'false' && process.env.NODE_ENV !== 'production')
    return NextResponse.next();
  const user = process.env.AUTH_USER,
    pass = process.env.AUTH_PASSWORD;
  if (!user || !pass || pass === 'replace-with-a-long-unique-password')
    return new NextResponse('Dashboard authentication is not configured.', { status: 503 });
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    try {
      const decoded = atob(auth.slice(6)),
        separator = decoded.indexOf(':'),
        u = decoded.slice(0, separator),
        p = decoded.slice(separator + 1);
      if (separator >= 0 && u === user && p === pass) return NextResponse.next();
    } catch {}
  }
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Gaming News Admin", charset="UTF-8"',
      'Cache-Control': 'no-store',
    },
  });
}
export const config = { matcher: ['/admin/:path*', '/api/:path*'] };
