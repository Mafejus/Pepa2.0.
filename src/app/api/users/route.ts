import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { hash } from "bcryptjs"

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 })
  if ((session.user as Record<string, unknown>).role !== "admin")
    return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 })

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true, email: true, jmeno: true, prijmeni: true,
      role: true, pozice: true, telefon: true, aktivni: true, createdAt: true,
    },
  })
  return NextResponse.json(users)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 })
  if ((session.user as Record<string, unknown>).role !== "admin")
    return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 })

  const body = await req.json()
  const { email, password, jmeno, prijmeni, role, pozice, telefon } = body

  if (!email || !password || !jmeno || !prijmeni)
    return NextResponse.json({ error: "Chybí povinné pole" }, { status: 400 })

  const passwordHash = await hash(password, 12)
  const user = await prisma.user.create({
    data: { email, passwordHash, jmeno, prijmeni, role: role ?? "zamestnanec", pozice, telefon },
    select: { id: true, email: true, jmeno: true, prijmeni: true, role: true, pozice: true },
  })
  return NextResponse.json(user, { status: 201 })
}
