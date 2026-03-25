import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const existing = await prisma.calendarEvent.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Try updating in Google Calendar if linked
    if (existing.googleEventId) {
      try {
        const { updateGoogleEvent } = await import("@/lib/google-calendar")
        await updateGoogleEvent(existing.googleEventId, {
          summary: body.nazev,
          start: body.zacatek,
          end: body.konec,
          location: body.lokace,
          description: body.poznamka,
          attendees: body.ucastnici?.map((e: string) => ({ email: e })),
        })
      } catch {
        // Google Calendar not connected or error — update DB only
      }
    }

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: {
        nazev: body.nazev,
        typ: body.typ ?? existing.typ,
        zacatek: new Date(body.zacatek),
        konec: new Date(body.konec),
        lokace: body.lokace ?? null,
        ucastnici: body.ucastnici ?? [],
        poznamka: body.poznamka ?? null,
        propertyId: body.propertyId ?? null,
      },
    })

    return NextResponse.json({
      ...updated,
      zacatek: updated.zacatek.toISOString(),
      konec: updated.konec.toISOString(),
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      source: "db",
    })
  } catch (err) {
    console.error("[/api/calendar/[id] PUT]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const existing = await prisma.calendarEvent.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Delete from Google Calendar if linked
    if (existing.googleEventId) {
      try {
        const { deleteGoogleEvent } = await import("@/lib/google-calendar")
        await deleteGoogleEvent(existing.googleEventId)
      } catch {
        // Google Calendar not connected or event already deleted — continue
      }
    }

    await prisma.calendarEvent.delete({ where: { id } })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[/api/calendar/[id] DELETE]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
