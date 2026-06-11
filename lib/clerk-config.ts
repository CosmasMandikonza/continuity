// Continuity is model- AND auth-independent: it must run with or without Clerk
// configured. This single check gates every Clerk code path so the scripted demo
// still works with zero keys (dev), and real multi-tenant auth turns on the moment
// NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY + CLERK_SECRET_KEY are present.
export function isClerkEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  )
}
