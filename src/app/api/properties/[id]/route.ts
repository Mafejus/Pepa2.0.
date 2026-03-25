import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.property.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[/api/properties DELETE]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const property = await prisma.property.update({ where: { id }, data: body })
    return NextResponse.json(property)
  } catch (err) {
    console.error("[/api/properties PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
