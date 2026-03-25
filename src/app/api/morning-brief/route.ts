import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export const maxDuration = 20

export async function GET(req: Request) {
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const [emailsResult, calendarResult, discountsResult, dbEventsResult] = await Promise.allSettled([
    // Unread emails
    fetch(`${baseUrl}/api/gmail?unread=true&limit=20`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }).then((r) => (r.ok ? r.json() : { emails: [], total: 0 })),

    // Google Calendar events today
    fetch(`${baseUrl}/api/calendar?timeMin=${todayStart.toISOString()}&timeMax=${todayEnd.toISOString()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }).then((r) => (r.ok ? r.json() : [])),

    // Discounted properties from Sreality
    fetch(
      "https://www.sreality.cz/api/cs/v2/estates?category_main_cb=1&category_type_cb=1&locality_search=Praha&per_page=60&tms=" +
        Date.now(),
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
          Referer: "https://www.sreality.cz/",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      }
    ).then((r) => (r.ok ? r.json() : null)),

    // DB calendar events (fallback)
    prisma.calendarEvent
      .findMany({
        where: { zacatek: { gte: todayStart, lt: todayEnd } },
        orderBy: { zacatek: "asc" },
        take: 10,
      })
      .catch(() => []),
  ])

  // ── Emails ───────────────────────────────────────────────────────────────────
  const emailData = emailsResult.status === "fulfilled" ? emailsResult.value : { emails: [], total: 0 }
  const unreadEmails: Array<{ id: string; od: string; predmet: string; snippet: string }> =
    emailData.emails ?? []
  const neprecteneCount = unreadEmails.length

  // ── Calendar ─────────────────────────────────────────────────────────────────
  const calendarData = calendarResult.status === "fulfilled" ? calendarResult.value : []
  const dbEvents = dbEventsResult.status === "fulfilled" ? dbEventsResult.value : []

  // Merge: Google Calendar events + DB events (deduplicate by googleEventId)
  type CalEvent = { id: string; nazev: string; typ: string; zacatek: string | Date; konec: string | Date; lokace?: string | null; googleEventId?: string | null }
  const googleEvents: CalEvent[] = Array.isArray(calendarData)
    ? calendarData
    : (calendarData as { events?: CalEvent[] }).events ?? []

  const dbGoogleIds = new Set(
    (dbEvents as CalEvent[]).map((e) => e.googleEventId).filter(Boolean)
  )
  const mergedEvents: CalEvent[] = [
    ...(dbEvents as CalEvent[]),
    ...googleEvents.filter((e) => !dbGoogleIds.has(e.googleEventId)),
  ].sort((a, b) => new Date(a.zacatek).getTime() - new Date(b.zacatek).getTime())

  const prohlídky = mergedEvents.filter((e) => e.typ === "prohlidka")
  const ostaniUdalosti = mergedEvents.filter((e) => e.typ !== "prohlidka")

  // ── Discounts ─────────────────────────────────────────────────────────────────
  const srealityJson = discountsResult.status === "fulfilled" ? discountsResult.value : null
  interface SrEstate {
    hash_id?: number
    name?: string
    price_czk?: { value_raw?: number }
    seo?: { locality?: string }
    labels?: string[]
  }
  const allEstates: SrEstate[] = srealityJson?._embedded?.estates ?? []
  const discounted = allEstates
    .filter((e) => {
      const price = e.price_czk?.value_raw ?? 0
      if (price < 100_000) return false
      return (e.labels ?? []).some(
        (l: string) =>
          l.toLowerCase().includes("zlevněno") ||
          l.toLowerCase().includes("snížen") ||
          l.toLowerCase().includes("sleva")
      )
    })
    .slice(0, 5)
    .map((e) => ({
      id: `sreality-${e.hash_id}`,
      nazev: e.name ?? "",
      cena: e.price_czk?.value_raw ?? 0,
      lokalita: e.seo?.locality ?? "",
      url: `https://www.sreality.cz/detail/prodej/byt/byt/${(e.seo?.locality ?? "")
        .toLowerCase()
        .replace(/\s+/g, "-")}/${e.hash_id}`,
    }))

  // ── Compose greeting ─────────────────────────────────────────────────────────
  const hour = now.getHours()
  const greeting =
    hour < 10 ? "Dobré ráno" : hour < 14 ? "Dobré dopoledne" : "Dobrý den"

  const parts: string[] = []
  if (neprecteneCount > 0) {
    parts.push(
      `📬 **${neprecteneCount} nepřečtených emailů**${
        unreadEmails[0] ? ` (nejnovější: ${unreadEmails[0].predmet})` : ""
      }`
    )
  }
  if (mergedEvents.length > 0) {
    const eventSummary = mergedEvents
      .slice(0, 3)
      .map((e) => {
        const cas = new Date(e.zacatek).toLocaleTimeString("cs-CZ", {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Europe/Prague",
        })
        return `${cas} ${e.nazev}`
      })
      .join(", ")
    parts.push(`📅 **${mergedEvents.length} událostí dnes** — ${eventSummary}`)
  }
  if (discounted.length > 0) {
    parts.push(`🔥 **${discounted.length} nových slev na Sreality** v Praze`)
  }

  const briefText =
    parts.length > 0
      ? `${greeting}! ${parts.join(" · ")} · Chceš to shrnout?`
      : `${greeting}! Vypadá to, že dnes máš klidný start.`

  return NextResponse.json({
    greeting,
    briefText,
    neprecteneCount,
    emails: unreadEmails.slice(0, 3).map((e) => ({
      id: e.id,
      od: e.od,
      predmet: e.predmet,
      snippet: e.snippet,
    })),
    events: mergedEvents.slice(0, 5).map((e) => ({
      id: e.id,
      nazev: e.nazev,
      typ: e.typ,
      zacatek: new Date(e.zacatek).toISOString(),
      lokace: e.lokace ?? null,
    })),
    prohlídkyCount: prohlídky.length,
    ostaniUdalostiCount: ostaniUdalosti.length,
    discounted: discounted.slice(0, 3),
    discountedCount: discounted.length,
  })
}
