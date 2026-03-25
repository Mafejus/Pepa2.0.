import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl

    const where: Record<string, unknown> = {}

    const zdroj = searchParams.get("zdroj")
    if (zdroj) where.zdroj = zdroj

    const status = searchParams.get("status")
    if (status) where.status = status

    const makler = searchParams.get("makler")
    if (makler) where.prirazenaMakler = makler

    const q1 = searchParams.get("q1")
    if (q1 === "true") {
      const now = new Date()
      const year = now.getFullYear()
      where.datumPrvnihoKontaktu = { gte: new Date(year, 0, 1), lt: new Date(year, 3, 1) }
    }

    const rok = searchParams.get("rok")
    if (rok) {
      const y = parseInt(rok)
      where.datumPrvnihoKontaktu = { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) }
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { datumPrvnihoKontaktu: "desc" },
    })

    return NextResponse.json(clients)
  } catch (err) {
    console.error("[/api/clients]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const client = await prisma.client.create({
      data: {
        ...body,
        datumPrvnihoKontaktu: body.datumPrvnihoKontaktu ? new Date(body.datumPrvnihoKontaktu) : new Date(),
        status: body.status ?? "novy",
        prirazenaMakler: body.prirazenaMakler ?? "Pepa Novák",
      },
    })
    return NextResponse.json(client, { status: 201 })
  } catch (err) {
    console.error("[/api/clients POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
