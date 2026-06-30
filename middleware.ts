import { type NextRequest, NextResponse } from 'next/server'

// Public paths that never require authentication
const PUBLIC = ['/login', '/favicon.ico', '/sin-acceso']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pass static assets and API routes through immediately
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return NextResponse.next()
  }

  // @supabase/ssr v0.10+ names cookies as "sb-<project-ref>-auth-token"
  // (chunked: "sb-<ref>-auth-token.0", ".1", etc.)
  // For self-hosted, <ref> derives from the URL hostname.
  // Also check the legacy "supabase.auth.token" name for backwards compat.
  const hasAuthCookie = request.cookies.getAll().some(
    (c) => (c.name.startsWith('sb-') && c.name.includes('-auth-token'))
          || c.name.startsWith('supabase.auth.token')
  )

  if (!hasAuthCookie) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
