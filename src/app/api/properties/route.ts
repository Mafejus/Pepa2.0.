import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const where: Record<string, unknown> = {}

    const stav = searchParams.get("stav")
    if (stav) where.stav = stav

    const typ = searchParams.get("typ")
    if (typ) where.typ = typ

    const lokalita = searchParams.get("lokalita")
    if (lokalita) where.lokalita = { contains: lokalita, mode: "insensitive" }

    const minCena = searchParams.get("minCena")
    const maxCena = searchParams.get("maxCena")
    if (minCena || maxCena) {
      where.cena = {
        ...(minCena ? { gte: parseFloat(minCena) } : {}),
        ...(maxCena ? { lte: parseFloat(maxCena) } : {}),
      }
    }

    const audit = searchParams.get("audit")
    if (audit === "true") {
      where.OR = [
        { rokRekonstrukce: null },
        { stavebniUpravy: null },
        { energetickaTrida: null },
        { fotky: false },
        { popisPopis: false },
      ]
    }

    const properties = await prisma.property.findMany({
      where,
      orderBy: { datumNasazeni: "desc" },
    })

    return NextResponse.json(properties)
  } catch (err) {
    console.error("[/api/properties]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const property = await prisma.property.create({ data: body })
    return NextResponse.json(property, { status: 201 })
  } catch (err) {
    console.error("[/api/properties POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
