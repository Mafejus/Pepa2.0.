import { NextRequest, NextResponse } from "next/server"
import { getEmails, getUnreadCount } from "@/lib/gmail"

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get("q") ?? "in:inbox"
    const limit = parseInt(url.searchParams.get("limit") ?? "20")
    const unreadOnly = url.searchParams.get("unread") === "true"
    const countOnly = url.searchParams.get("countOnly") === "true"

    if (countOnly) {
      const count = await getUnreadCount()
      return NextResponse.json({ count })
    }

    const query = unreadOnly ? `${q} is:unread` : q
    const emails = await getEmails(limit, query)
    return NextResponse.json({ emails, total: emails.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    if (msg.includes("not connected")) {
      return NextResponse.json({ error: "Google not connected", emails: [], total: 0 }, { status: 401 })
    }
    return NextResponse.json({ error: msg, emails: [], total: 0 }, { status: 500 })
  }
}
