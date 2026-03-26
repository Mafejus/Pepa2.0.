import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST() {
  try {
    await prisma.googleToken.deleteMany()
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
