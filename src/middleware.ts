import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware pass-through.
 * Authentication is handled client-side via Firebase Auth and the useAuth hook.
 * This middleware exists to reserve the matcher config for dashboard routes
 * in case server-side checks are needed in the future.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
