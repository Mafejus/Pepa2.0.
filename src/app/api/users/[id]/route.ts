import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { hash } from "bcryptjs"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 })
  if ((session.user as Record<string, unknown>).role !== "admin")
    return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const { password, ...rest } = body

  const data: Record<string, unknown> = { ...rest }
  if (password) data.passwordHash = await hash(password, 12)

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, jmeno: true, prijmeni: true, role: true, pozice: true, aktivni: true },
  })
  return NextResponse.json(user)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 })
  if ((session.user as Record<string, unknown>).role !== "admin")
    return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 })

  const { id } = await params
  const user = await prisma.user.update({
    where: { id },
    data: { aktivni: false },
    select: { id: true },
  })
  return NextResponse.json(user)
}
