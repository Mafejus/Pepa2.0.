import { NextRequest, NextResponse } from "next/server"
import { sendEmail } from "@/lib/gmail"

export async function POST(req: NextRequest) {
  try {
    const { to, subject, body } = await req.json()
    if (!to || !subject || !body) {
      return NextResponse.json({ error: "Missing to, subject, or body" }, { status: 400 })
    }
    const id = await sendEmail(to, subject, body)
    return NextResponse.json({ success: true, id })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
