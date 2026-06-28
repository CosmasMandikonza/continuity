import { NextResponse, type NextRequest } from 'next/server'
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { isClerkEnabled } from '@/lib/clerk-config'

// Next.js 16 renamed `middleware` to `proxy` (same mechanism, new filename).
// Delete the old middleware.ts — only this file should remain.
//
// Public routes. The marketing landing + pricing are public, and so is the app
// itself in GUEST/DEMO mode: signed-out visitors (and judges following the deploy
// link) can explore the full product against a shared demo shop (the DEV tenant,
// resolved in getTenantContext). Creating a shop gives them their own isolated,
// private workspace. Only the privileged migration/backfill API routes still
// require a session.
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/pricing(.*)',
  '/bench(.*)',
  '/repairs(.*)',
  '/graph(.*)',
  '/fleet(.*)',
  '/api/diagnose(.*)',
])

// When Clerk is configured, protect everything except the sign-in/up pages and
// land signed-out users on /sign-in. When it is NOT configured (dev / no keys),
// this is a pass-through so the scripted demo runs with zero setup.
const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export default function proxy(req: NextRequest, event: any) {
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
    // Always run for Clerk's frontend API routes.
    '/__clerk/(.*)',
  ],
}
