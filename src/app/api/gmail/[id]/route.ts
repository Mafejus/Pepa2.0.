import { NextRequest, NextResponse } from "next/server"
import { getEmailById, markAsRead } from "@/lib/gmail"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const email = await getEmailById(id)
    if (!email) return NextResponse.json({ error: "Not found" }, { status: 404 })
    // Mark as read when opened
    if (!email.precteno) {
      await markAsRead(id).catch(() => {})
    }
    return NextResponse.json(email)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
