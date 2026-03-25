import { NextResponse } from "next/server"
import { getOAuthClient } from "@/lib/google-calendar"

export async function GET() {
  const oauth2Client = getOAuthClient()

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  })

  return NextResponse.redirect(authUrl)
}
