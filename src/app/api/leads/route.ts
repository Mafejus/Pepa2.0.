import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const where: Record<string, unknown> = {}

    const status = searchParams.get("status")
    if (status) where.status = status

    const zdroj = searchParams.get("zdroj")
    if (zdroj) where.zdroj = zdroj

    const klientId = searchParams.get("klientId")
    if (klientId) where.klientId = klientId

    const mesic = searchParams.get("mesic")
    if (mesic) {
      const [year, month] = mesic.split("-").map(Number)
      where.datumVytvoreni = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      }
    }

    const leads = await prisma.lead.findMany({
      where,
      include: { klient: true, property: true },
      orderBy: { datumAktualizace: "desc" },
    })

    return NextResponse.json(leads)
  } catch (err) {
    console.error("[/api/leads]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const now = new Date()
    const lead = await prisma.lead.create({
      data: {
        ...body,
        datumVytvoreni: body.datumVytvoreni ? new Date(body.datumVytvoreni) : now,
        datumAktualizace: body.datumAktualizace ? new Date(body.datumAktualizace) : now,
        status: body.status ?? "novy",
      },
      include: { klient: true, property: true },
    })
    return NextResponse.json(lead, { status: 201 })
  } catch (err) {
    console.error("[/api/leads POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
