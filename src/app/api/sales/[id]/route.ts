import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { property: true, klient: true, prodavajici: true },
    })

    if (!sale) {
      return NextResponse.json({ error: "Prodej nenalezen" }, { status: 404 })
    }

    return NextResponse.json(sale)
  } catch (err) {
    console.error("[/api/sales/[id] GET]", err)
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

    const existing = await prisma.sale.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Prodej nenalezen" }, { status: 404 })
    }

    const sale = await prisma.sale.update({
      where: { id },
      data: body,
      include: { property: true, klient: true, prodavajici: true },
    })

    return NextResponse.json(sale)
  } catch (err) {
    console.error("[/api/sales/[id] PATCH]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.sale.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Prodej nenalezen" }, { status: 404 })
    }

    await prisma.sale.delete({ where: { id } })

    await prisma.property.update({
      where: { id: existing.propertyId },
      data: { stav: "aktivni" },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[/api/sales/[id] DELETE]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
