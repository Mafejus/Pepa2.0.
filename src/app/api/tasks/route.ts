import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const assignedTo = searchParams.get("assignedTo")
  const status     = searchParams.get("status")
  const priority   = searchParams.get("priority")

  const userId = (session.user as Record<string, unknown>).id as string
  const isAdmin = (session.user as Record<string, unknown>).role === "admin"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {}
  if (!isAdmin) where.assignedToId = userId
  else if (assignedTo) where.assignedToId = assignedTo
  if (status && status !== "vse") where.status = status
  if (priority) where.priority = priority

  const tasks = await prisma.task.findMany({
    where,
    include: { assignedTo: { select: { id: true, jmeno: true, prijmeni: true, pozice: true } }, createdBy: { select: { id: true, jmeno: true, prijmeni: true } } },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
  })
  return NextResponse.json(tasks)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Nepřihlášen" }, { status: 401 })

  const body = await req.json()
  const { title, description, assignedToId, type, priority, dueDate, propertyId, clientId, notes } = body
  const createdById = (session.user as Record<string, unknown>).id as string

  if (!title || !assignedToId)
    return NextResponse.json({ error: "Chybí povinné pole" }, { status: 400 })

  const task = await prisma.task.create({
    data: {
      title, description: description ?? "", type: type ?? "obecny",
      priority: priority ?? "normal", assignedToId, createdById,
      dueDate: dueDate ? new Date(dueDate) : null,
      propertyId: propertyId ?? null, clientId: clientId ?? null,
      notes: notes ?? null,
    },
    include: { assignedTo: { select: { id: true, jmeno: true, prijmeni: true } }, createdBy: { select: { id: true, jmeno: true, prijmeni: true } } },
  })
  return NextResponse.json(task, { status: 201 })
}
