import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { klient: true, property: true },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead nenalezen" }, { status: 404 })
    }

    return NextResponse.json(lead)
  } catch (err) {
    console.error("[/api/leads/[id] GET]", err)
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

    const existing = await prisma.lead.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Lead nenalezen" }, { status: 404 })
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...body,
        datumAktualizace: new Date(),
      },
      include: { klient: true, property: true },
    })

    return NextResponse.json(lead)
  } catch (err) {
    console.error("[/api/leads/[id] PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.lead.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Lead nenalezen" }, { status: 404 })
    }

    await prisma.lead.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[/api/leads/[id] DELETE]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
