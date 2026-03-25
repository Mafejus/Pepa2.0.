import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const stav = url.searchParams.get("stav")
    const priorita = url.searchParams.get("priorita")

    const where: Record<string, unknown> = {}
    if (stav) where.stav = stav
    if (priorita) where.priorita = priorita

    const notes = await prisma.note.findMany({
      where,
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(notes)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const note = await prisma.note.create({
      data: {
        titulek: body.titulek,
        obsah: body.obsah ?? "",
        stav: body.stav ?? "todo",
        priorita: body.priorita ?? "medium",
        tagy: body.tagy ?? [],
      },
    })
    return NextResponse.json(note, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
