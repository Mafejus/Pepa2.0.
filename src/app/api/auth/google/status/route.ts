import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET() {
  try {
    const token = await prisma.googleToken.findUnique({ where: { id: "default" } })
    if (!token) {
      return NextResponse.json({ connected: false, email: null })
    }
    return NextResponse.json({ connected: true, email: token.email })
  } catch {
    return NextResponse.json({ connected: false, email: null })
  }
}
