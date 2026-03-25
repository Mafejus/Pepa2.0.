import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 })

  const { id } = await params
  const body = await req.json()

  // If marking as done, set completedAt
  if (body.status === "hotovo") body.completedAt = new Date().toISOString()

  const task = await prisma.task.update({
    where: { id },
    data: body,
    include: { assignedTo: { select: { id: true, jmeno: true, prijmeni: true } } },
  })
  return NextResponse.json(task)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 })

  const userId  = (session.user as Record<string, unknown>).id as string
  const isAdmin = (session.user as Record<string, unknown>).role === "admin"

  const { id } = await params
  const task = await prisma.task.findUnique({ where: { id } })
  if (!task) return NextResponse.json({ error: "Nenalezeno" }, { status: 404 })
  if (!isAdmin && task.createdById !== userId)
    return NextResponse.json({ error: "Nedostatečná oprávnění" }, { status: 403 })

  await prisma.task.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
