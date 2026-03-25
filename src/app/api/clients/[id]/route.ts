import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        leads: { include: { property: true } },
        purchasedSales: { include: { property: true } },
        soldSales: { include: { property: true } },
      },
    })

    if (!client) {
      return NextResponse.json({ error: "Klient nenalezen" }, { status: 404 })
    }

    return NextResponse.json(client)
  } catch (err) {
    console.error("[/api/clients/[id] GET]", err)
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

    const existing = await prisma.client.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Klient nenalezen" }, { status: 404 })
    }

    const client = await prisma.client.update({
      where: { id },
      data: body,
    })

    return NextResponse.json(client)
  } catch (err) {
    console.error("[/api/clients/[id] PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.client.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Klient nenalezen" }, { status: 404 })
    }

    const activeStatuses = [
      "novy",
      "kontaktovan",
      "prohlidka_domluvena",
      "nabidka_odeslana",
      "vyjednavani",
    ]

    const activeLeads = await prisma.lead.count({
      where: {
        klientId: id,
        status: { in: activeStatuses },
      },
    })

    if (activeLeads > 0) {
      return NextResponse.json(
        { error: "Klient má aktivní leady, nelze smazat" },
        { status: 400 }
      )
    }

    await prisma.client.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[/api/clients/[id] DELETE]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
