import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware — passes all requests through.
 * Auth checks happen per-page via client-side session reads.
 * This avoids runtime crashes from auth-helpers version mismatches.
 */
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
