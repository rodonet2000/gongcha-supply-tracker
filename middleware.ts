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

  // Fast cookie presence check — no network call, no Supabase client init.
  // @supabase/ssr sets cookies named "sb-*-auth-token".
  // Server Components do the actual session validation via getCurrentUser().
  const hasAuthCookie = request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
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
