import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { getGoogleEvents } from "@/lib/google-calendar"

function getWeekBounds(date: Date) {
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(date)
  monday.setDate(date.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl

    let timeMin: Date
    let timeMax: Date

    const timeMinParam = searchParams.get("timeMin")
    const timeMaxParam = searchParams.get("timeMax")
    const tyden = searchParams.get("tyden")

    if (timeMinParam && timeMaxParam) {
      timeMin = new Date(timeMinParam)
      timeMax = new Date(timeMaxParam)
    } else if (tyden === "next") {
      const next = new Date()
      next.setDate(next.getDate() + 7)
      const { monday, sunday } = getWeekBounds(next)
      timeMin = monday
      timeMax = sunday
    } else {
      // default: current week
      const { monday, sunday } = getWeekBounds(new Date())
      timeMin = monday
      timeMax = sunday
    }

    // DB events
    const dbEvents = await prisma.calendarEvent.findMany({
      where: {
        zacatek: { gte: timeMin, lte: timeMax },
      },
      orderBy: { zacatek: "asc" },
    })

    const dbMapped = dbEvents.map((e) => ({
      id: e.id,
      nazev: e.nazev,
      typ: e.typ,
      zacatek: e.zacatek.toISOString(),
      konec: e.konec.toISOString(),
      lokace: e.lokace,
      ucastnici: e.ucastnici,
      poznamka: e.poznamka,
      propertyId: e.propertyId,
      googleEventId: e.googleEventId,
      source: "db" as const,
    }))

    // Google Calendar events (optional)
    type EventRow = (typeof dbMapped)[0]
    let googleMapped: (Omit<EventRow, "source"> & { source: "google" })[] = []
    try {
      const googleEvents = await getGoogleEvents(
        timeMin.toISOString(),
        timeMax.toISOString()
      )
      // Filter out events already synced to DB
      const dbGoogleIds = new Set(dbMapped.map((e) => e.googleEventId).filter(Boolean))
      googleMapped = googleEvents
        .filter((e) => !dbGoogleIds.has(e.googleEventId ?? null))
        .map((e) => ({ ...e, source: "google" as const }))
    } catch {
      // Google Calendar not connected or error — silently skip
    }

    const allEvents = [...dbMapped, ...googleMapped].sort(
      (a, b) => new Date(a.zacatek).getTime() - new Date(b.zacatek).getTime()
    )

    // Free slots mode
    const volne = searchParams.get("volne")
    if (volne === "true") {
      const freeSlots: { den: string; zacatek: string; konec: string }[] = []
      const { monday } = getWeekBounds(new Date())

      for (let d = 0; d < 5; d++) {
        const day = new Date(monday)
        day.setDate(monday.getDate() + d)
        const dayStr = day.toISOString().slice(0, 10)
        const dayEvents = allEvents.filter((e) => e.zacatek.startsWith(dayStr))

        for (let h = 9; h < 17; h++) {
          const slotStart = `${dayStr}T${String(h).padStart(2, "0")}:00:00Z`
          const slotEnd = `${dayStr}T${String(h + 1).padStart(2, "0")}:00:00Z`
          const busy = dayEvents.some((e) => {
            const eStart = new Date(e.zacatek).getUTCHours()
            const eEnd = new Date(e.konec).getUTCHours()
            return eStart < h + 1 && eEnd > h
          })
          if (!busy) freeSlots.push({ den: dayStr, zacatek: slotStart, konec: slotEnd })
        }
      }
      return NextResponse.json({ freeSlots: freeSlots.slice(0, 8) })
    }

    return NextResponse.json(allEvents)
  } catch (err) {
    console.error("[/api/calendar]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { createGoogleEvent } = await import("@/lib/google-calendar")

    let googleEventId: string | undefined

    // Try creating in Google Calendar
    try {
      const gEvent = await createGoogleEvent({
        summary: body.nazev,
        start: body.zacatek,
        end: body.konec,
        location: body.lokace,
        description: body.poznamka,
        attendees: body.ucastnici?.map((e: string) => ({ email: e })),
      })
      googleEventId = gEvent.id ?? undefined
    } catch {
      // Not connected — save to DB only
    }

    const event = await prisma.calendarEvent.create({
      data: {
        nazev: body.nazev,
        typ: body.typ ?? "jine",
        zacatek: new Date(body.zacatek),
        konec: new Date(body.konec),
        lokace: body.lokace ?? null,
        ucastnici: body.ucastnici ?? [],
        poznamka: body.poznamka ?? null,
        propertyId: body.propertyId ?? null,
        googleEventId: googleEventId ?? null,
      },
    })

    return NextResponse.json({ ...event, source: "db" }, { status: 201 })
  } catch (err) {
    console.error("[/api/calendar POST]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
