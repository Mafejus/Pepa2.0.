import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await req.json()
    const note = await prisma.note.update({
      where: { id },
      data: {
        ...(body.titulek !== undefined && { titulek: body.titulek }),
        ...(body.obsah !== undefined && { obsah: body.obsah }),
        ...(body.stav !== undefined && { stav: body.stav }),
        ...(body.priorita !== undefined && { priorita: body.priorita }),
        ...(body.tagy !== undefined && { tagy: body.tagy }),
      },
    })
    return NextResponse.json(note)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await prisma.note.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
