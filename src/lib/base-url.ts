/**
 * Resolves the application's base URL, with proper support for Railway, Vercel, and localhost.
 *
 * Priority:
 * 1. NEXT_PUBLIC_BASE_URL — explicit override set by the operator
 * 2. NEXTAUTH_URL / AUTH_URL — already configured for auth callbacks
 * 3. RAILWAY_PUBLIC_DOMAIN — automatically set by Railway
 * 4. VERCEL_URL — automatically set by Vercel
 * 5. localhost:3000 — local development fallback
 */
export function getBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : undefined) ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : undefined) ??
    "http://localhost:3000"
  )
}
