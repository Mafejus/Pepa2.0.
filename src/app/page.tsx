import Link from "next/link"
import { Building2, Users, TrendingUp, Banknote, MapPin, Calendar, Bot, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

function formatCZK(amount: number): string {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("cs-CZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Prague",
  })
}

const EVENT_TYPE_CONFIG = {
  prohlidka: { label: "Prohlídka", color: "bg-blue-500/10 text-blue-700 ring-blue-500/20" },
  meeting: { label: "Meeting", color: "bg-violet-500/10 text-violet-700 ring-violet-500/20" },
  foceni: { label: "Focení", color: "bg-amber-500/10 text-amber-700 ring-amber-500/20" },
  administrativa: { label: "Admin", color: "bg-slate-500/10 text-slate-600 ring-slate-500/20" },
  jine: { label: "Jiné", color: "bg-slate-500/10 text-slate-600 ring-slate-500/20" },
} as const

export default async function DashboardPage() {
  const now = new Date()
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  let aktivniNemovitosti = 0
  let aktivniNemovitostiLastMonth = 0
  let noviKlientiThisMonth = 0
  let noviKlientiLastMonth = 0
  let aktivniLeady = 0
  let aktivniLeadyLastMonth = 0
  let trzbyThisMonth = { _sum: { provize: null as number | null } }
  let trzbyLastMonth = { _sum: { provize: null as number | null } }
  let upcomingEvents: Array<{ id: string; nazev: string; typ: string; zacatek: Date; konec: Date; lokace: string | null; googleEventId?: string | null }> = []
  let allLeads: Array<{ status: string }> = []

  try {
    ;[
      aktivniNemovitosti,
      aktivniNemovitostiLastMonth,
      noviKlientiThisMonth,
      noviKlientiLastMonth,
      aktivniLeady,
      aktivniLeadyLastMonth,
      trzbyThisMonth,
      trzbyLastMonth,
      upcomingEvents,
      allLeads,
    ] = await Promise.all([
      prisma.property.count({ where: { stav: "aktivni" } }),
      prisma.property.count({
        where: { stav: "aktivni", datumNasazeni: { lt: startOfThisMonth } },
      }),
      prisma.client.count({
        where: { datumPrvnihoKontaktu: { gte: startOfThisMonth, lt: startOfNextMonth } },
      }),
      prisma.client.count({
        where: { datumPrvnihoKontaktu: { gte: startOfLastMonth, lt: startOfThisMonth } },
      }),
      prisma.lead.count({
        where: {
          status: { in: ["novy", "kontaktovan", "prohlidka_domluvena", "nabidka_odeslana", "vyjednavani"] },
        },
      }),
      prisma.lead.count({
        where: {
          status: { in: ["novy", "kontaktovan", "prohlidka_domluvena", "nabidka_odeslana", "vyjednavani"] },
          datumVytvoreni: { lt: startOfThisMonth },
        },
      }),
      prisma.sale.aggregate({
        _sum: { provize: true },
        where: { datumProdeje: { gte: startOfThisMonth, lt: startOfNextMonth } },
      }),
      prisma.sale.aggregate({
        _sum: { provize: true },
        where: { datumProdeje: { gte: startOfLastMonth, lt: startOfThisMonth } },
      }),
      prisma.calendarEvent.findMany({
        where: { zacatek: { gte: now } },
        orderBy: { zacatek: "asc" },
        take: 20,
        select: { id: true, nazev: true, typ: true, zacatek: true, konec: true, lokace: true, googleEventId: true },
      }),
      prisma.lead.findMany({ select: { status: true } }),
    ])

    // Merge Google Calendar events
    try {
      const { getGoogleEvents } = await import("@/lib/google-calendar")
      const twoWeeksOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
      const googleEvents = await getGoogleEvents(now.toISOString(), twoWeeksOut.toISOString())
      const dbGoogleIds = new Set(upcomingEvents.map((e) => e.googleEventId).filter(Boolean))
      const googleOnly = googleEvents
        .filter((e) => !dbGoogleIds.has(e.googleEventId))
        .map((e) => ({
          id: e.id,
          nazev: e.nazev,
          typ: e.typ,
          zacatek: new Date(e.zacatek),
          konec: new Date(e.konec),
          lokace: e.lokace,
          googleEventId: e.googleEventId,
        }))
      upcomingEvents = [...upcomingEvents, ...googleOnly]
        .filter((e) => e.zacatek >= now)
        .sort((a, b) => a.zacatek.getTime() - b.zacatek.getTime())
        .slice(0, 4)
    } catch {
      // Google not connected or unavailable — use DB events only
      upcomingEvents = upcomingEvents.slice(0, 4)
    }
  } catch {
    // DB not available — render with empty data
  }

  const aktivniChange =
    aktivniNemovitostiLastMonth > 0
      ? Math.round(((aktivniNemovitosti - aktivniNemovitostiLastMonth) / aktivniNemovitostiLastMonth) * 100)
      : 0

  const klientiChange =
    noviKlientiLastMonth > 0
      ? Math.round(((noviKlientiThisMonth - noviKlientiLastMonth) / noviKlientiLastMonth) * 100)
      : 100

  const leadyChange =
    aktivniLeadyLastMonth > 0
      ? Math.round(((aktivniLeady - aktivniLeadyLastMonth) / aktivniLeadyLastMonth) * 100)
      : 0

  const trzbyThisMonthVal = trzbyThisMonth._sum.provize ?? 0
  const trzbyLastMonthVal = trzbyLastMonth._sum.provize ?? 0
  const trzbyChange =
    trzbyLastMonthVal > 0
      ? Math.round(((trzbyThisMonthVal - trzbyLastMonthVal) / trzbyLastMonthVal) * 100)
      : 0

  const pipelineStatuses = ["novy", "kontaktovan", "prohlidka_domluvena", "nabidka_odeslana", "vyjednavani"] as const
  const leadCounts = Object.fromEntries(
    pipelineStatuses.map((s) => [s, allLeads.filter((l) => l.status === s).length])
  )
  const uzavrenoCount = allLeads.filter((l) => l.status === "uzavreno").length
  const ztracenoCount = allLeads.filter((l) => l.status === "ztraceno").length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Přehled agentury —{" "}
          {now.toLocaleDateString("cs-CZ", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="ring-0 border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Aktivní nemovitosti
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50">
                <Building2 className="h-4 w-4 text-blue-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-metric text-3xl font-semibold text-slate-900">{aktivniNemovitosti}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                  aktivniChange >= 0
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                    : "bg-red-50 text-red-700 ring-red-600/20"
                }`}
              >
                {aktivniChange >= 0 ? "+" : ""}
                {aktivniChange} %
              </span>
              <span className="text-[11px] text-slate-400">oproti min. měsíci</span>
            </div>
          </CardContent>
        </Card>

        <Card className="ring-0 border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Noví klienti
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
                <Users className="h-4 w-4 text-violet-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-metric text-3xl font-semibold text-slate-900">{noviKlientiThisMonth}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                  klientiChange >= 0
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                    : "bg-red-50 text-red-700 ring-red-600/20"
                }`}
              >
                {klientiChange >= 0 ? "+" : ""}
                {klientiChange} %
              </span>
              <span className="text-[11px] text-slate-400">oproti min. měsíci</span>
            </div>
          </CardContent>
        </Card>

        <Card className="ring-0 border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Leady v pipeline
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50">
                <TrendingUp className="h-4 w-4 text-amber-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-metric text-3xl font-semibold text-slate-900">{aktivniLeady}</div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                  leadyChange >= 0
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                    : "bg-red-50 text-red-700 ring-red-600/20"
                }`}
              >
                {leadyChange >= 0 ? "+" : ""}
                {leadyChange} %
              </span>
              <span className="text-[11px] text-slate-400">oproti min. měsíci</span>
            </div>
          </CardContent>
        </Card>

        <Card className="ring-0 border border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Tržby tento měsíc
              </CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
                <Banknote className="h-4 w-4 text-emerald-600" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="font-metric text-2xl font-semibold text-slate-900 leading-tight">
              {formatCZK(trzbyThisMonthVal)}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${
                  trzbyChange >= 0
                    ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                    : "bg-red-50 text-red-700 ring-red-600/20"
                }`}
              >
                {trzbyChange >= 0 ? "+" : ""}
                {trzbyChange} %
              </span>
              <span className="text-[11px] text-slate-400">oproti min. měsíci</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CTA — AI Agent */}
      <Link href="/agent" className="block group">
        <Card className="ring-0 border border-emerald-200 shadow-sm bg-gradient-to-r from-emerald-50 to-white hover:border-emerald-300 hover:shadow-md transition-all duration-150">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 ring-2 ring-emerald-500/20">
              <Bot className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900">Zeptej se Pepy</div>
              <p className="text-xs text-slate-500 mt-0.5">
                Analyzuj data, vytvoř grafy, piš emaily nebo audituj nemovitosti pomocí AI
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-emerald-500 shrink-0 group-hover:translate-x-0.5 transition-transform duration-150" />
          </CardContent>
        </Card>
      </Link>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="ring-0 border border-slate-200 shadow-sm bg-white">
          <CardHeader className="border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-emerald-500" />
                Nadcházející události
              </CardTitle>
              <span className="text-[11px] text-slate-400 font-medium">příští události</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {upcomingEvents.length === 0 ? (
              <p className="px-4 py-6 text-[12px] text-slate-400 text-center">Žádné nadcházející události</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {upcomingEvents.map((event) => {
                  const config = EVENT_TYPE_CONFIG[event.typ as keyof typeof EVENT_TYPE_CONFIG] ?? EVENT_TYPE_CONFIG.jine
                  return (
                    <li
                      key={event.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="mt-0.5 flex flex-col items-center gap-0.5 min-w-[40px]">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase">
                          {event.zacatek.toLocaleDateString("cs-CZ", {
                            weekday: "short",
                            timeZone: "Europe/Prague",
                          })}
                        </span>
                        <span className="font-metric text-xs font-medium text-slate-700">
                          {formatTime(event.zacatek)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-800">{event.nazev}</p>
                          <span
                            className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${config.color}`}
                          >
                            {config.label}
                          </span>
                        </div>
                        {event.lokace && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-400">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{event.lokace}</span>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="ring-0 border border-slate-200 shadow-sm bg-white">
          <CardHeader className="border-b border-slate-100 pb-3">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Pipeline přehled
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {(
                [
                  { key: "novy", label: "Nové leady", color: "bg-slate-400" },
                  { key: "kontaktovan", label: "Kontaktováni", color: "bg-blue-400" },
                  { key: "prohlidka_domluvena", label: "Prohlídka", color: "bg-violet-400" },
                  { key: "nabidka_odeslana", label: "Nabídka", color: "bg-amber-400" },
                  { key: "vyjednavani", label: "Vyjednávání", color: "bg-orange-400" },
                ] as const
              ).map(({ key, label, color }) => {
                const count = leadCounts[key] ?? 0
                const pct = allLeads.length > 0 ? Math.round((count / allLeads.length) * 100) : 0
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="w-24 shrink-0 text-[12px] text-slate-600 font-medium">{label}</div>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color}`}
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                    <span className="font-metric text-xs font-semibold text-slate-700 w-5 text-right">
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
                <div className="font-metric text-xl font-bold text-emerald-700">{uzavrenoCount}</div>
                <div className="text-[11px] font-medium text-emerald-600/80 mt-0.5">Uzavřeno celkem</div>
              </div>
              <div className="rounded-lg bg-red-50 px-3 py-2.5">
                <div className="font-metric text-xl font-bold text-red-600">{ztracenoCount}</div>
                <div className="text-[11px] font-medium text-red-500/80 mt-0.5">Ztraceno celkem</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
