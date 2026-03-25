import { NextRequest, NextResponse } from "next/server"
import { google } from "googleapis"
import { prisma } from "@/lib/db"
import { getOAuthClient } from "@/lib/google-calendar"

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  if (!code) {
    return NextResponse.redirect(new URL("/kalendar?error=no_code", req.url))
  }

  try {
    const oauth2Client = getOAuthClient()
    const { tokens } = await oauth2Client.getToken(code)

    // Get user email (optional — may fail if email scope not granted)
    oauth2Client.setCredentials(tokens)
    let email: string | null = null
    try {
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client })
      const userInfo = await oauth2.userinfo.get()
      email = userInfo.data.email ?? null
    } catch {
      // email scope not available — continue without email
    }

    await prisma.googleToken.upsert({
      where: { id: "default" },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? undefined,
        expiresAt: new Date(tokens.expiry_date!),
        email,
      },
      create: {
        id: "default",
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token ?? "",
        expiresAt: new Date(tokens.expiry_date!),
        email,
      },
    })

    return NextResponse.redirect(new URL("/kalendar?connected=true", req.url))
  } catch (err) {
    console.error("[Google OAuth callback]", err)
    return NextResponse.redirect(new URL("/kalendar?error=oauth_failed", req.url))
  }
}
