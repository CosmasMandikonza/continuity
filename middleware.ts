import { NextResponse, type NextRequest } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { isClerkEnabled } from '@/lib/clerk-config'

// Public routes that never require a session. The marketing landing at "/" is
// public so signed-out visitors (and judges following the deploy link) see it;
// everything else still requires a session when Clerk is configured.
const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)'])

// When Clerk is configured, protect everything except the sign-in/up pages and
// land signed-out users on /sign-in. When it is NOT configured (dev / no keys),
// the middleware is a pass-through so the scripted demo runs with zero setup.
const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export default function middleware(req: NextRequest, event: any) {
  if (!isClerkEnabled()) {
    return NextResponse.next()
  }
  return clerkHandler(req, event)
}

export const config = {
  matcher: [
    // Skip Next internals and static files, run on everything else.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
  ],
}
