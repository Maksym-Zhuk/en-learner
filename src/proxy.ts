import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/register', '/api/auth/login', '/api/auth/register', '/api/auth/logout', '/s/', '/api/s/', '/invite/', '/api/invites/']

/**
 * Lightweight JWT check for the Edge Runtime.
 * We only need to verify the signature is present and the token isn't expired —
 * full crypto verification happens in each API route via jsonwebtoken (Node.js).
 */
function isTokenStructurallyValid(token: string): boolean {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false

    // Decode payload (base64url)
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')
    )

    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) return false
    if (!payload.userId || !payload.email) return false

    return true
  } catch {
    return false
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    /\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|map|woff2?|ttf|txt|json)$/i.test(pathname)
  ) {
    return NextResponse.next()
  }

  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token || !isTokenStructurallyValid(token)) {
    const response = NextResponse.redirect(new URL('/login', request.url))
    if (token) response.cookies.delete(COOKIE_NAME)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
