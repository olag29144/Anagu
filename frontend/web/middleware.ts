import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ROLE_DASHBOARD_PATHS = {
  citizen: '/citizen',
  surveyor: '/citizen',
  registrar: '/registrar',
  land_admin: '/admin',
  governor: '/governor',
} as const;

const PROTECTED_PATHS = [
  { path: '/dashboard', allow: ['citizen', 'surveyor', 'registrar', 'land_admin', 'governor'] },
  { path: '/citizen', allow: ['citizen', 'surveyor'] },
  { path: '/registrar', allow: ['registrar'] },
  { path: '/admin', allow: ['land_admin'] },
  { path: '/governor', allow: ['governor'] },
  { path: '/audit', allow: ['citizen', 'surveyor', 'registrar', 'land_admin', 'governor'] },
] as const;

function getUserRole(user: Record<string, unknown> | null): string | undefined {
  const metadata = (user as Record<string, unknown> | null) ?? null;
  const appMetadata = (metadata?.app_metadata as Record<string, unknown> | undefined) ?? {};
  const userMetadata = (metadata?.user_metadata as Record<string, unknown> | undefined) ?? {};

  const rawRole =
    (appMetadata.role as string | undefined) ??
    (appMetadata.user_role as string | undefined) ??
    (userMetadata.role as string | undefined) ??
    (userMetadata.user_role as string | undefined);

  if (typeof rawRole !== 'string') {
    return undefined;
  }

  return rawRole.toLowerCase();
}

function getRoleRedirectPath(role: string | undefined): string {
  if (!role) {
    return '/dashboard';
  }

  return ROLE_DASHBOARD_PATHS[role as keyof typeof ROLE_DASHBOARD_PATHS] ?? '/dashboard';
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

  let user: Record<string, unknown> | null = null;

  // 1. Check for demo account cookie first
  const demoRole = req.cookies.get('anagu_demo_role')?.value;
  const demoUserEmail = req.cookies.get('anagu_demo_user')?.value;
  const demoUserName = req.cookies.get('anagu_demo_name')?.value;

  if (demoRole) {
    const cleanRole = demoRole.toLowerCase();
    user = {
      id: `demo-user-${cleanRole}`,
      email: demoUserEmail ? decodeURIComponent(demoUserEmail) : `${cleanRole}@anagu.gov.ng`,
      user_metadata: {
        role: cleanRole,
        full_name: demoUserName ? decodeURIComponent(demoUserName) : 'Demo Officer',
      },
      app_metadata: { role: cleanRole },
    };
  } else {
    // 2. Fall back to Supabase session
    try {
      const supabase = createMiddlewareClient(
        { req, res },
        { supabaseUrl, supabaseKey },
      );
      const { data } = await supabase.auth.getUser();
      user = (data?.user as unknown as Record<string, unknown>) ?? null;
    } catch {
      user = null;
    }
  }

  const pathname = req.nextUrl.pathname;
  const protectedRoute = PROTECTED_PATHS.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  );

  const userRole = getUserRole(user);

  if (pathname === '/' && user && !req.nextUrl.searchParams.has('public')) {
    return NextResponse.redirect(new URL(getRoleRedirectPath(userRole), req.url));
  }

  if (pathname === '/login' && user) {
    return NextResponse.redirect(new URL(getRoleRedirectPath(userRole), req.url));
  }

  if (protectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (protectedRoute && userRole) {
    const allowedRoles = protectedRoute.allow as readonly string[];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.redirect(new URL(getRoleRedirectPath(userRole), req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|assets).*)'],
};
