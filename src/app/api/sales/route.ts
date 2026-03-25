import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const where: Record<string, unknown> = {}

    const typObchodu = searchParams.get("typObchodu")
    if (typObchodu) where.typObchodu = typObchodu

    const mesic = searchParams.get("mesic")
    if (mesic) {
      const [year, month] = mesic.split("-").map(Number)
      where.datumProdeje = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      }
    }

    const od = searchParams.get("od")
    const do_ = searchParams.get("do")
    if (od || do_) {
      where.datumProdeje = {
        ...(od ? { gte: new Date(od) } : {}),
        ...(do_ ? { lte: new Date(do_) } : {}),
      }
    }

    const sales = await prisma.sale.findMany({
      where,
      include: { property: true, klient: true, prodavajici: true },
      orderBy: { datumProdeje: "desc" },
    })

    return NextResponse.json(sales)
  } catch (err) {
    console.error("[/api/sales]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { propertyId, klientId, prodavajiciId, datumProdeje, cenaFinalni, provize, typObchodu } = body

    if (!propertyId || !klientId || !prodavajiciId || !datumProdeje || cenaFinalni == null || provize == null || !typObchodu) {
      return NextResponse.json({ error: "Chybí povinné pole" }, { status: 400 })
    }

    const sale = await prisma.sale.create({
      data: {
        propertyId,
        klientId,
        prodavajiciId,
        datumProdeje: new Date(datumProdeje),
        cenaFinalni,
        provize,
        typObchodu,
      },
      include: { property: true, klient: true, prodavajici: true },
    })

    await prisma.property.update({ where: { id: propertyId }, data: { stav: "prodano" } })

    return NextResponse.json(sale, { status: 201 })
  } catch (err) {
    console.error("[/api/sales POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
