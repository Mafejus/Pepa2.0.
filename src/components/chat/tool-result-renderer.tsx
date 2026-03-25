"use client"

import { useState, useCallback } from "react"
import { toast } from "@/lib/toast"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Building2,
  Mail,
  Copy,
  Check,
  AlertTriangle,
  TrendingUp,
  Radio,
  ExternalLink,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
} from "lucide-react"

const CHART_COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#06b6d4",
]

function formatCZK(n: number) {
  return new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  }).format(n)
}

// ──────────────────────────────────────────────
// CHART RENDERER
// ──────────────────────────────────────────────
function ChartRenderer({ output }: { output: unknown }) {
  const data = output as {
    chartType: "bar" | "line" | "pie" | "area"
    title: string
    data: Record<string, string | number>[]
    xAxisKey: string
    yAxisKey: string
    yAxisKey2?: { leady: string; prodeje: string }
  }

  const common = {
    data: data.data,
    margin: { top: 5, right: 20, left: 10, bottom: 5 },
  }

  const renderChart = () => {
    switch (data.chartType) {
      case "bar":
        if (data.yAxisKey2) {
          return (
            <BarChart {...common}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={data.xAxisKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar
                dataKey="leady"
                name="Leady"
                fill={CHART_COLORS[0]}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="prodeje"
                name="Prodeje"
                fill={CHART_COLORS[1]}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          )
        }
        return (
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey={data.xAxisKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v) =>
                typeof v === "number" && v > 100000 ? formatCZK(v) : v
              }
            />
            <Bar
              dataKey={data.yAxisKey}
              name="Hodnota"
              radius={[3, 3, 0, 0]}
            >
              {data.data.map((_: unknown, i: number) => (
                <Cell
                  key={i}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        )

      case "line":
        if (data.yAxisKey2) {
          return (
            <LineChart {...common}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={data.xAxisKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="leady"
                name="Leady"
                stroke={CHART_COLORS[0]}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="prodeje"
                name="Prodeje"
                stroke={CHART_COLORS[1]}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          )
        }
        return (
          <LineChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey={data.xAxisKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v) =>
                typeof v === "number" && v > 100000 ? formatCZK(v) : v
              }
            />
            <Legend />
            <Line
              type="monotone"
              dataKey={data.yAxisKey}
              stroke={CHART_COLORS[0]}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          </LineChart>
        )

      case "area":
        return (
          <AreaChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey={data.xAxisKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v) =>
                typeof v === "number" && v > 100000 ? formatCZK(v) : v
              }
            />
            <Area
              type="monotone"
              dataKey={data.yAxisKey}
              stroke={CHART_COLORS[0]}
              fill={`${CHART_COLORS[0]}20`}
              strokeWidth={2}
            />
          </AreaChart>
        )

      case "pie":
        return (
          <PieChart>
            <Pie
              data={data.data}
              dataKey={data.yAxisKey}
              nameKey={data.xAxisKey}
              cx="50%"
              cy="50%"
              outerRadius={90}
              label={({ name, percent }: { name?: string; percent?: number }) =>
                `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
              }
              labelLine={false}
            >
              {data.data.map((_: unknown, i: number) => (
                <Cell
                  key={i}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        )
    }
  }

  return (
    <Card className="mt-2 border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          {data.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <ResponsiveContainer width="100%" height={260}>
          {renderChart() as React.ReactElement}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// EMAIL DRAFT RENDERER
// ──────────────────────────────────────────────
function EmailRenderer({ output }: { output: unknown }) {
  const email = output as {
    to: string
    subject: string
    body: string
    suggestedTerminy: string[]
  }
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(
      `Komu: ${email.to}\nPředmět: ${email.subject}\n\n${email.body}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast("Email zkopírován do schránky")
  }

  return (
    <Card className="mt-2 border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-500" />
            Návrh emailu
          </CardTitle>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-500" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Zkopírováno" : "Kopírovat"}
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-16 shrink-0">
            Komu
          </span>
          <span className="text-sm font-medium text-slate-800">{email.to}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 w-16 shrink-0">
            Předmět
          </span>
          <span className="text-sm text-slate-700">{email.subject}</span>
        </div>
        <div className="mt-3 rounded-lg bg-slate-50 border border-slate-100 p-4">
          <pre className="text-[13px] text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
            {email.body}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// AUDIT RENDERER
// ──────────────────────────────────────────────
function AuditRenderer({ output }: { output: unknown }) {
  const audit = output as {
    chybejici: Array<{
      property: { nazev: string; lokalita: string; stav: string }
      chybejiciPole: string[]
    }>
    celkemNemovitosti: number
    celkemSChybou: number
    doporuceniDalsiKrok: string
  }

  return (
    <Card className="mt-2 border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Audit nemovitostí
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 text-center">
            <div className="font-metric text-2xl font-bold text-slate-800">
              {audit.celkemNemovitosti}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Celkem</div>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
            <div className="font-metric text-2xl font-bold text-amber-700">
              {audit.celkemSChybou}
            </div>
            <div className="text-[11px] text-amber-600 mt-0.5">
              S chybějícími daty
            </div>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
            <div className="font-metric text-2xl font-bold text-emerald-700">
              {audit.celkemNemovitosti - audit.celkemSChybou}
            </div>
            <div className="text-[11px] text-emerald-600 mt-0.5">
              Kompletní
            </div>
          </div>
        </div>

        {audit.doporuceniDalsiKrok && (
          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-100 p-3">
            <CheckCircle className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-blue-700">
              {audit.doporuceniDalsiKrok}
            </p>
          </div>
        )}

        {audit.chybejici.length > 0 && (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-2 px-3">
                    Nemovitost
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-2 px-3">
                    Lokalita
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 py-2 px-3">
                    Chybí
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {audit.chybejici.map((item, i) => (
                  <TableRow
                    key={i}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <TableCell className="py-2 px-3 text-[12px] font-medium text-slate-800">
                      {item.property.nazev}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-[12px] text-slate-500">
                      {item.property.lokalita}
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {item.chybejiciPole.map((pole, j) => (
                          <Badge
                            key={j}
                            className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200 hover:bg-red-50"
                          >
                            {pole}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// REPORT RENDERER
// ──────────────────────────────────────────────
const SLIDE_GRADIENTS = [
  "from-blue-600 to-blue-800",
  "from-emerald-600 to-emerald-800",
  "from-violet-600 to-violet-800",
  "from-amber-500 to-orange-700",
]

function ReportRenderer({ output }: { output: unknown }) {
  const report = output as {
    nazev: string
    obdobi: string
    klicoveMetriky: {
      novychLeadu: number
      uzavrenychObchodu: number
      trzba: number
      noveNemovitosti: number
      provedeneProhlidky: number
      konverzniPomer?: number
    }
    prezentaceSlidy: Array<{ titulek: string; podnazev?: string; obsah: string[]; takeaway?: string }>
  }

  const [slide, setSlide] = useState(0)
  const [copied, setCopied] = useState(false)

  const slides = report.prezentaceSlidy ?? []
  const totalSlides = slides.length
  const currentSlide = slides[slide]
  const gradient = SLIDE_GRADIENTS[slide % SLIDE_GRADIENTS.length]

  const copyReport = useCallback(() => {
    const lines: string[] = [
      `${report.nazev} — ${report.obdobi}`,
      "",
      "KLÍČOVÉ METRIKY",
      `• Nové leady: ${report.klicoveMetriky.novychLeadu}`,
      `• Uzavřeno: ${report.klicoveMetriky.uzavrenychObchodu}`,
      `• Tržby: ${formatCZK(report.klicoveMetriky.trzba)}`,
      `• Prohlídky: ${report.klicoveMetriky.provedeneProhlidky}`,
      ...(report.klicoveMetriky.konverzniPomer !== undefined
        ? [`• Konverzní poměr: ${report.klicoveMetriky.konverzniPomer} %`]
        : []),
      "",
      ...slides.flatMap((s, i) => [
        `SLIDE ${i + 1}: ${s.titulek}`,
        ...(s.podnazev ? [`${s.podnazev}`] : []),
        ...s.obsah.map((b) => `  • ${b}`),
        ...(s.takeaway ? [`→ ${s.takeaway}`] : []),
        "",
      ]),
    ]
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [report, slides])

  const kpis = [
    { label: "Nové leady", value: report.klicoveMetriky.novychLeadu, color: "blue" },
    { label: "Uzavřeno", value: report.klicoveMetriky.uzavrenychObchodu, color: "emerald" },
    { label: "Tržby", value: formatCZK(report.klicoveMetriky.trzba), color: "emerald" },
    { label: "Prohlídky", value: report.klicoveMetriky.provedeneProhlidky, color: "violet" },
    ...(report.klicoveMetriky.konverzniPomer !== undefined
      ? [{ label: "Konverze", value: `${report.klicoveMetriky.konverzniPomer} %`, color: "amber" }]
      : []),
  ]

  return (
    <Card className="mt-2 border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <CardHeader className="pb-2 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            {report.nazev}
            <span className="text-slate-400 font-normal text-xs">{report.obdobi}</span>
          </CardTitle>
          <button
            onClick={copyReport}
            className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Zkopírováno" : "Kopírovat report"}
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {kpis.map((m) => (
            <div
              key={m.label}
              className={`rounded-lg p-3 text-center border ${
                m.color === "emerald" ? "bg-emerald-50 border-emerald-100" :
                m.color === "blue"    ? "bg-blue-50 border-blue-100" :
                m.color === "violet"  ? "bg-violet-50 border-violet-100" :
                                        "bg-amber-50 border-amber-100"
              }`}
            >
              <div className={`text-xl font-bold tabular-nums ${
                m.color === "emerald" ? "text-emerald-700" :
                m.color === "blue"    ? "text-blue-700" :
                m.color === "violet"  ? "text-violet-700" :
                                        "text-amber-700"
              }`}>
                {m.value}
              </div>
              <div className={`text-[10px] font-medium mt-0.5 ${
                m.color === "emerald" ? "text-emerald-600/80" :
                m.color === "blue"    ? "text-blue-600/80" :
                m.color === "violet"  ? "text-violet-600/80" :
                                        "text-amber-600/80"
              }`}>
                {m.label}
              </div>
            </div>
          ))}
        </div>

        {/* Slide deck */}
        {totalSlides > 0 && (
          <div className="rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            {/* Slide header */}
            <div className={`bg-gradient-to-br ${gradient} px-5 py-4 text-white`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-1">
                    Slide {slide + 1} / {totalSlides}
                  </div>
                  <h3 className="text-base font-bold leading-snug">{currentSlide.titulek}</h3>
                  {currentSlide.podnazev && (
                    <p className="text-[12px] text-white/75 mt-1 leading-relaxed">{currentSlide.podnazev}</p>
                  )}
                </div>
                <div className="shrink-0 flex items-center gap-1 mt-1">
                  <button
                    onClick={() => setSlide((s) => Math.max(0, s - 1))}
                    disabled={slide === 0}
                    className="rounded-full p-1 text-white/70 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setSlide((s) => Math.min(totalSlides - 1, s + 1))}
                    disabled={slide === totalSlides - 1}
                    className="rounded-full p-1 text-white/70 hover:text-white hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {/* Dot indicators */}
              <div className="flex items-center gap-1.5 mt-3">
                {slides.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlide(i)}
                    className={`rounded-full transition-all ${
                      i === slide ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Slide content */}
            <div className="bg-white px-5 py-4">
              <ul className="space-y-2">
                {currentSlide.obsah.map((item, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-[13px] text-slate-700">
                    <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                    {item}
                  </li>
                ))}
              </ul>

              {currentSlide.takeaway && (
                <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[12px] font-medium text-amber-800">{currentSlide.takeaway}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// MONITORING RENDERER
// ──────────────────────────────────────────────
function MonitoringRenderer({ output }: { output: unknown }) {
  const mon = output as {
    results: Array<{
      id: string
      server: string
      nazev: string
      cena: number
      lokalita: string
      url: string
      plocha: number
      dispozice: string
      datumNalezeni: string
      novinka: boolean
    }>
    noveDnes: number
    celkem: number
    servery: Record<string, number>
  }

  return (
    <Card className="mt-2 border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-500" />
            Monitoring — {mon.celkem} nabídek
          </CardTitle>
          <div className="flex items-center gap-2">
            {Object.entries(mon.servery).map(([server, count]) => (
              <Badge key={server} className="text-[10px] bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100">
                {server} ({count})
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 p-0">
        <div className="divide-y divide-slate-100">
          {mon.results.slice(0, 8).map((r) => (
            <div
              key={r.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/70 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-medium text-slate-800 truncate">
                    {r.nazev}
                  </span>
                  {r.novinka && (
                    <Badge className="text-[9px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 shrink-0">
                      NOVÉ
                    </Badge>
                  )}
                  <Badge className="text-[9px] px-1.5 py-0 bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-50 shrink-0">
                    {r.server}
                  </Badge>
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500">
                  <span className="font-metric font-semibold text-slate-700">
                    {formatCZK(r.cena)}
                  </span>
                  <span>·</span>
                  <span>{r.dispozice}</span>
                  <span>·</span>
                  <span>{r.plocha} m²</span>
                  <span>·</span>
                  <span>{r.lokalita}</span>
                </div>
              </div>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-slate-400 hover:text-emerald-600 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// CALENDAR RENDERER
// ──────────────────────────────────────────────
function CalendarRenderer({ output }: { output: unknown }) {
  const cal = output as {
    events: Array<{
      id: string
      nazev: string
      typ: string
      zacatek: string
      konec: string
      lokace: string | null
      ucastnici: string[]
    }>
    volneSloty?: Array<{ den: string; zacatek: string; konec: string }>
  }

  const events = cal.events ?? []
  const volneSloty = cal.volneSloty ?? []

  const TYP_COLORS: Record<string, string> = {
    prohlidka: "bg-blue-50 text-blue-700 border-blue-200",
    meeting: "bg-violet-50 text-violet-700 border-violet-200",
    foceni: "bg-amber-50 text-amber-700 border-amber-200",
    administrativa: "bg-slate-100 text-slate-600 border-slate-200",
    jine: "bg-slate-100 text-slate-600 border-slate-200",
  }
  const TYP_LABELS: Record<string, string> = {
    prohlidka: "Prohlídka",
    meeting: "Meeting",
    foceni: "Focení",
    administrativa: "Admin",
    jine: "Jiné",
  }

  return (
    <Card className="mt-2 border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-500" />
          Kalendář — {events.length} událostí
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {events.slice(0, 6).map((event) => (
            <div
              key={event.id}
              className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors"
            >
              <div className="text-center min-w-[44px]">
                <div className="text-[10px] font-semibold uppercase text-slate-400">
                  {new Date(event.zacatek).toLocaleDateString("cs-CZ", {
                    weekday: "short",
                    timeZone: "Europe/Prague",
                  })}
                </div>
                <div className="font-metric text-[11px] font-medium text-slate-700">
                  {new Date(event.zacatek).toLocaleTimeString("cs-CZ", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "Europe/Prague",
                  })}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-medium text-slate-800 truncate">
                    {event.nazev}
                  </p>
                  <Badge
                    className={`text-[9px] px-1.5 py-0 shrink-0 border ${
                      TYP_COLORS[event.typ] || TYP_COLORS.jine
                    } hover:opacity-100`}
                  >
                    {TYP_LABELS[event.typ] || event.typ}
                  </Badge>
                </div>
                {event.lokace && (
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {event.lokace}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
        {volneSloty.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <p className="text-[11px] font-semibold text-emerald-700 mb-2">
              Volné termíny
            </p>
            <div className="flex flex-wrap gap-2">
              {volneSloty.slice(0, 6).map((slot, i) => (
                <div
                  key={i}
                  className="rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-medium text-emerald-700"
                >
                  {new Date(slot.den).toLocaleDateString("cs-CZ", {
                    weekday: "short",
                    day: "numeric",
                    month: "numeric",
                    timeZone: "UTC",
                  })}{" "}
                  {slot.zacatek.slice(11, 16)}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// DATA TABLE RENDERER (clients / properties / leads)
// ──────────────────────────────────────────────
function DataTableRenderer({ toolName, output }: { toolName: string; output: unknown }) {
  const data = output as Record<string, unknown>

  if (toolName === "queryClients") {
    const result = data as {
      clients: Array<{
        id: string
        jmeno: string
        prijmeni: string
        email: string
        telefon: string
        typ: string
        zdroj: string
        status: string
        prirazenaMakler: string
      }>
      totalCount: number
      summary: {
        zdrojBreakdown: Record<string, number>
        typBreakdown: Record<string, number>
      }
    }

    return (
      <Card className="mt-2 border border-slate-200 shadow-sm">
        <CardHeader className="pb-2 border-b border-slate-100">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-violet-500" />
            Klienti — {result.totalCount} výsledků
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border border-slate-200 overflow-hidden mx-4 my-3">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  {["Jméno", "Email", "Typ", "Zdroj", "Status", "Makléř"].map(
                    (h) => (
                      <TableHead
                        key={h}
                        className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 py-2 px-3"
                      >
                        {h}
                      </TableHead>
                    )
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.clients.slice(0, 8).map((c) => (
                  <TableRow key={c.id} className="hover:bg-slate-50/50">
                    <TableCell className="py-2 px-3 text-[12px] font-medium text-slate-800">
                      {c.jmeno} {c.prijmeni}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-[11px] text-slate-500">
                      {c.email}
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <Badge className="text-[10px] px-1.5 py-0 bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-50">
                        {c.typ}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-3 text-[11px] text-slate-500">
                      {c.zdroj}
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <Badge
                        className={`text-[10px] px-1.5 py-0 border hover:opacity-100 ${
                          c.status === "aktivni"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : c.status === "novy"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : c.status === "uzavreny"
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-red-50 text-red-600 border-red-200"
                        }`}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-3 text-[11px] text-slate-500">
                      {c.prirazenaMakler.split(" ")[0]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (toolName === "queryProperties") {
    const result = data as {
      properties: Array<{
        id: string
        nazev: string
        typ: string
        lokalita: string
        cena: number
        plocha: number
        dispozice: string
        stav: string
      }>
      totalCount: number
      cenaPrumer: number
      cenaMedian: number
    }

    return (
      <Card className="mt-2 border border-slate-200 shadow-sm">
        <CardHeader className="pb-2 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              Nemovitosti — {result.totalCount}
            </CardTitle>
            <div className="flex gap-3 text-[11px]">
              <span className="text-slate-400">
                Průměr:{" "}
                <span className="font-semibold text-slate-700 font-metric">
                  {formatCZK(result.cenaPrumer)}
                </span>
              </span>
              <span className="text-slate-400">
                Medián:{" "}
                <span className="font-semibold text-slate-700 font-metric">
                  {formatCZK(result.cenaMedian)}
                </span>
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border border-slate-200 overflow-hidden mx-4 my-3">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  {["Nemovitost", "Lokalita", "Cena", "Plocha", "Stav"].map(
                    (h) => (
                      <TableHead
                        key={h}
                        className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 py-2 px-3"
                      >
                        {h}
                      </TableHead>
                    )
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.properties.slice(0, 8).map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/50">
                    <TableCell className="py-2 px-3 text-[12px] font-medium text-slate-800">
                      {p.nazev}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-[11px] text-slate-500">
                      {p.lokalita}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-[11px] font-metric font-semibold text-slate-700">
                      {formatCZK(p.cena)}
                    </TableCell>
                    <TableCell className="py-2 px-3 text-[11px] text-slate-500">
                      {p.plocha} m²
                    </TableCell>
                    <TableCell className="py-2 px-3">
                      <Badge
                        className={`text-[10px] px-1.5 py-0 border hover:opacity-100 ${
                          p.stav === "aktivni"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : p.stav === "rezervovano"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : p.stav === "prodano"
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {p.stav}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Generic summary for other data tools
  return (
    <Card className="mt-2 border border-slate-200 shadow-sm">
      <CardContent className="pt-4">
        <pre className="text-[11px] text-slate-600 whitespace-pre-wrap overflow-auto max-h-48 rounded bg-slate-50 p-3">
          {JSON.stringify(data, null, 2)}
        </pre>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// READ EMAILS RENDERER
// ──────────────────────────────────────────────
function ReadEmailsRenderer({ output }: { output: unknown }) {
  const data = output as {
    emails: Array<{
      id: string
      od: string
      predmet: string
      datum: string
      snippet: string
      precteno: boolean
    }>
    total: number
    error?: string
  }

  if (data.error) {
    return (
      <Card className="mt-2 border border-slate-200 shadow-sm">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-[12px] text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {data.error === "Google not connected"
              ? "Gmail není připojený. Přejdi na Nastavení a připoj Google účet."
              : data.error}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-2 border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          <Mail className="h-4 w-4 text-blue-500" />
          Emaily — {data.emails.length} zpráv
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {data.emails.slice(0, 6).map((e) => (
            <div key={e.id} className="px-4 py-3 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${e.precteno ? "bg-slate-300" : "bg-blue-500"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[12px] truncate ${!e.precteno ? "font-semibold text-slate-900" : "text-slate-700"}`}>
                      {e.od.replace(/^"(.+?)".*$/, "$1").replace(/<.*>/, "").trim() || e.od}
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {new Date(e.datum).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <p className={`text-[11px] truncate ${!e.precteno ? "font-medium text-slate-800" : "text-slate-600"}`}>
                    {e.predmet || "(bez předmětu)"}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{e.snippet}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        {data.emails.length === 0 && (
          <div className="py-8 text-center text-[12px] text-slate-400">Žádné emaily</div>
        )}
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// SEND GMAIL RENDERER
// ──────────────────────────────────────────────
function SendGmailRenderer({ output }: { output: unknown }) {
  const data = output as { success: boolean; message?: string; error?: string; id?: string }
  return (
    <Card className="mt-2 border border-slate-200 shadow-sm">
      <CardContent className="pt-4">
        <div className={`flex items-center gap-2 text-[13px] ${data.success ? "text-emerald-700" : "text-red-600"}`}>
          {data.success ? (
            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          )}
          {data.message || data.error || "Hotovo"}
        </div>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// NOTES RENDERER
// ──────────────────────────────────────────────
function NotesRenderer({ output }: { output: unknown }) {
  const data = output as {
    notes: Array<{
      id: string
      titulek: string
      obsah: string
      stav: string
      priorita: string
      tagy: string[]
    }>
    total: number
    todoCount: number
    inProgressCount: number
    doneCount: number
    error?: string
  }

  const STAV_COLORS: Record<string, string> = {
    todo: "bg-slate-100 text-slate-600",
    in_progress: "bg-amber-100 text-amber-700",
    done: "bg-emerald-100 text-emerald-700",
  }
  const STAV_LABELS: Record<string, string> = {
    todo: "K udělání",
    in_progress: "Probíhá",
    done: "Hotovo",
  }

  return (
    <Card className="mt-2 border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            📋 Poznámky & Úkoly — {data.total} celkem
          </CardTitle>
          <div className="flex gap-2 text-[11px]">
            <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100">{data.todoCount} todo</Badge>
            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{data.inProgressCount} probíhá</Badge>
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{data.doneCount} hotovo</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {data.notes.slice(0, 6).map((note) => (
            <div key={note.id} className="px-4 py-3 hover:bg-slate-50/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-slate-800 truncate">{note.titulek}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${STAV_COLORS[note.stav] || "bg-slate-100 text-slate-600"}`}>
                      {STAV_LABELS[note.stav] || note.stav}
                    </span>
                  </div>
                  {note.obsah && (
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{note.obsah}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {data.notes.length === 0 && (
          <div className="py-8 text-center text-[12px] text-slate-400">Žádné poznámky</div>
        )}
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// CREATE NOTE RENDERER
// ──────────────────────────────────────────────
function CreateNoteRenderer({ output }: { output: unknown }) {
  const data = output as {
    success: boolean
    message?: string
    note?: { titulek: string; stav: string; priorita: string }
    error?: string
  }
  return (
    <Card className="mt-2 border border-slate-200 shadow-sm">
      <CardContent className="pt-4">
        <div className={`flex items-center gap-2 text-[13px] ${data.success ? "text-emerald-700" : "text-red-600"}`}>
          {data.success ? (
            <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          )}
          {data.message || data.error || (data.note ? `Vytvořeno: ${data.note.titulek}` : "Hotovo")}
        </div>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// ANALYZE UPLOAD RENDERER
// ──────────────────────────────────────────────
function AnalyzeUploadRenderer({ output }: { output: unknown }) {
  const data = output as {
    id?: string
    nazev?: string
    typ?: string
    velikost?: number
    analyza?: Record<string, unknown>
    error?: string
  }

  if (data.error) {
    return (
      <Card className="mt-2 border border-slate-200 shadow-sm">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-[12px] text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {data.error}
          </div>
        </CardContent>
      </Card>
    )
  }

  const analyza = data.analyza ?? {}
  const formatSize = (bytes?: number) => {
    if (!bytes) return ""
    return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <Card className="mt-2 border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100">
        <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
          📂 Analýza souboru
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-3">
          <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 uppercase text-[10px]">
            {data.typ}
          </Badge>
          <span className="text-[13px] font-medium text-slate-800">{data.nazev}</span>
          <span className="text-[11px] text-slate-400">{formatSize(data.velikost)}</span>
        </div>
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
          <pre className="text-[11px] text-slate-600 whitespace-pre-wrap overflow-auto max-h-48">
            {JSON.stringify(analyza, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// SEARCH REAL ESTATE RENDERER
// ──────────────────────────────────────────────
function SearchRealEstateRenderer({ output }: { output: unknown }) {
  const data = output as {
    results: Array<{
      id: string
      nazev: string
      cena: number
      lokalita: string
      url: string
      plocha: number
      dispozice: string
      obrazek?: string
    }>
    celkem: number
    filtry: { lokalita: string; typ: string; nabidka: string; minCena?: number; maxCena?: number }
    statistiky: { cenaPrumer: number; cenaMin: number; cenaMax: number }
    dalsiServery: Array<{ server: string; url: string; label: string }>
    error?: string
  }

  if (data.error && data.results.length === 0) {
    return (
      <Card className="mt-2 border border-slate-200 shadow-sm">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 text-[12px] text-red-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Sreality nedostupná: {data.error}
          </div>
        </CardContent>
      </Card>
    )
  }

  const formatCena = (n: number) => {
    if (!n || n < 1000) return "Na vyžádání"
    if (n >= 1_000_000) {
      const v = n / 1_000_000
      return `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)} mil. Kč`
    }
    return `${n.toLocaleString("cs-CZ")} Kč`
  }

  const SERVER_COLORS: Record<string, string> = {
    bezrealitky: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    idnes: "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100",
    bazos: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
    realitymix: "bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100",
  }

  return (
    <Card className="mt-2 border border-slate-200 shadow-sm">
      <CardHeader className="pb-2 border-b border-slate-100">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-blue-500" />
            Sreality — {data.celkem} nabídek
          </CardTitle>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
            <span className="font-medium text-slate-700">{data.filtry.lokalita}</span>
            {data.filtry.minCena || data.filtry.maxCena ? (
              <span>
                {data.filtry.minCena ? formatCena(data.filtry.minCena) : "–"} –{" "}
                {data.filtry.maxCena ? formatCena(data.filtry.maxCena) : "max"}
              </span>
            ) : null}
            {data.statistiky.cenaPrumer > 0 && (
              <span>Průměr: <span className="font-semibold text-slate-700">{formatCena(data.statistiky.cenaPrumer)}</span></span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {data.results.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-slate-400">Žádné výsledky pro zadaná kritéria</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x-0">
            {data.results.slice(0, 10).map((r) => (
              <div key={r.id} className="flex flex-col border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                {r.obrazek && (
                  <div className="h-28 overflow-hidden bg-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.obrazek}
                      alt={r.nazev}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => { const p = e.currentTarget.parentElement; if (p) p.style.display = "none" }}
                    />
                  </div>
                )}
                <div className="px-3 py-2.5 flex flex-col gap-1 flex-1">
                  <p className="text-[12px] font-semibold text-slate-800 leading-snug line-clamp-2">{r.nazev}</p>
                  <div className="text-[14px] font-bold text-slate-900">{formatCena(r.cena)}</div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
                    {r.plocha > 0 && <span>{r.plocha} m²</span>}
                    {r.plocha > 0 && r.dispozice && <span>·</span>}
                    {r.dispozice && <span>{r.dispozice}</span>}
                    {r.plocha > 0 && r.cena > 1000 && (
                      <>
                        <span>·</span>
                        <span className="text-slate-400">{Math.round(r.cena / r.plocha).toLocaleString("cs-CZ")} Kč/m²</span>
                      </>
                    )}
                  </div>
                  {r.lokalita && <p className="text-[10px] text-slate-400 truncate">{r.lokalita}</p>}
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    Otevřít inzerát
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {data.dalsiServery.length > 0 && (
          <div className="border-t border-slate-100 px-4 py-3">
            <p className="text-[11px] font-semibold text-slate-500 mb-2">Hledat také na</p>
            <div className="flex flex-wrap gap-2">
              {data.dalsiServery.map((s) => (
                <a
                  key={s.server}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-colors ${SERVER_COLORS[s.server] ?? "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"}`}
                >
                  <ExternalLink className="h-3 w-3" />
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// SEARCH DOCUMENTS RENDERER
// ──────────────────────────────────────────────
function SearchDocumentsRenderer({ output }: { output: unknown }) {
  const data = output as {
    documents: Array<{ id: string; filename: string; category: string; summary: string | null; createdAt: string }>
    celkem: number
    error?: string
  }
  const docs = data?.documents ?? []
  const categoryColors: Record<string, string> = {
    smlouva: "bg-blue-100 text-blue-700",
    nabidka: "bg-emerald-100 text-emerald-700",
    report: "bg-purple-100 text-purple-700",
    faktura: "bg-amber-100 text-amber-700",
    technicka_zprava: "bg-slate-100 text-slate-600",
    jiny: "bg-slate-100 text-slate-500",
  }
  const categoryLabels: Record<string, string> = {
    smlouva: "Smlouva", nabidka: "Nabídka", report: "Report",
    faktura: "Faktura", technicka_zprava: "Tech. zpráva", jiny: "Jiný",
  }
  return (
    <Card className="border-slate-200 bg-white shadow-sm w-full max-w-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
          <span>📄</span>
          <span>Nalezeno {data?.celkem ?? 0} dokumentů</span>
        </div>
        {docs.length === 0 && (
          <p className="text-[12px] text-slate-400">Žádné dokumenty nenalezeny.</p>
        )}
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold text-slate-900 leading-snug">{doc.filename}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColors[doc.category] ?? categoryColors.jiny}`}>
                  {categoryLabels[doc.category] ?? doc.category}
                </span>
              </div>
              {doc.summary && <p className="mt-1 text-[12px] text-slate-500 leading-relaxed line-clamp-2">{doc.summary}</p>}
              <p className="mt-1 text-[10px] text-slate-400">{new Date(doc.createdAt).toLocaleDateString("cs-CZ")}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// FIND DISCOUNTS RENDERER
// ──────────────────────────────────────────────
function FindDiscountsRenderer({ output }: { output: unknown }) {
  const data = output as {
    discounted: Array<{ id: string; nazev: string; cena: number; lokalita: string; url: string; labels: string[] }>
    celkem: number
    lokalita: string
    error?: string
  }
  const items = data?.discounted ?? []

  function formatPrice(n: number) {
    if (!n) return "—"
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")} mil. Kč`
    return `${n.toLocaleString("cs-CZ")} Kč`
  }

  return (
    <Card className="border-slate-200 bg-white shadow-sm w-full max-w-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <span className="text-[13px] font-semibold text-slate-800">
            {data?.celkem ?? 0} zlevněných nemovitostí — {data?.lokalita ?? "Praha"}
          </span>
        </div>
        {items.length === 0 && (
          <p className="text-[12px] text-slate-400">Žádné zlevněné nemovitosti nenalezeny. Zkus jiné vyhledávání.</p>
        )}
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50 p-3 gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold text-slate-900 leading-snug truncate">{item.nazev}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{item.lokalita}</p>
                {item.labels?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {item.labels.slice(0, 2).map((l, i) => (
                      <span key={i} className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-600">{l}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[14px] font-bold text-emerald-600">{formatPrice(item.cena)}</p>
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 justify-end mt-0.5">
                    <ExternalLink className="h-2.5 w-2.5" /> Otevřít
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// MARKET NEWS RENDERER
// ──────────────────────────────────────────────
function MarketNewsRenderer({ output }: { output: unknown }) {
  const data = output as {
    news: Array<{ titulek: string; zdroj: string; datum: string; shrnutí: string; url: string; sentiment: string }>
    lokalita: string
    error?: string
  }
  const items = data?.news ?? []
  const sentimentColor = (s: string) =>
    s === "pozitivni" ? "bg-emerald-100 text-emerald-700" : s === "negativni" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
  const sentimentLabel = (s: string) =>
    s === "pozitivni" ? "Pozitivní" : s === "negativni" ? "Negativní" : "Neutrální"

  return (
    <Card className="border-slate-200 bg-white shadow-sm w-full max-w-2xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-slate-800">
          <span>📰</span>
          <span>Zprávy z trhu — {data?.lokalita ?? "Česko"}</span>
        </div>
        {items.length === 0 && <p className="text-[12px] text-slate-400">Žádné zprávy nenalezeny.</p>}
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border border-slate-100 p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-semibold text-slate-900 leading-snug">{item.titulek}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${sentimentColor(item.sentiment)}`}>
                  {sentimentLabel(item.sentiment)}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">{item.zdroj} · {item.datum}</p>
              <p className="text-[12px] text-slate-600 leading-relaxed">{item.shrnutí}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────
// MAIN TOOL RESULT RENDERER
// ──────────────────────────────────────────────
interface ToolResultRendererProps {
  toolName: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error"
  input?: unknown
  output?: unknown
  errorText?: string
}

export function ToolResultRenderer({
  toolName,
  state,
  input,
  output,
  errorText,
}: ToolResultRendererProps) {
  const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
    queryClients: { label: "Hledám klienty…", icon: "👥" },
    queryProperties: { label: "Hledám nemovitosti…", icon: "🏠" },
    queryLeadsAndSales: { label: "Načítám leady a prodeje…", icon: "📈" },
    getCalendar: { label: "Kontroluji kalendář…", icon: "📅" },
    createCalendarEvent: { label: "Vytvářím událost…", icon: "📅" },
    draftEmail: { label: "Píšu email…", icon: "✉️" },
    auditProperties: { label: "Audituji nemovitosti…", icon: "🔍" },
    generateChart: { label: "Generuji graf…", icon: "📊" },
    generateReport: { label: "Připravuji report…", icon: "📋" },
    getMonitoring: { label: "Kontroluji monitoring…", icon: "📡" },
    readEmails: { label: "Čtu emaily…", icon: "📬" },
    sendGmail: { label: "Odesílám email…", icon: "📤" },
    createNote: { label: "Vytvářím poznámku…", icon: "📝" },
    getNotes: { label: "Načítám poznámky…", icon: "📋" },
    analyzeUpload: { label: "Analyzuji soubor…", icon: "📂" },
    searchRealEstate: { label: "Hledám nemovitosti na trhu…", icon: "🔎" },
    searchDocuments: { label: "Prohledávám dokumenty…", icon: "📄" },
    readDocument: { label: "Čtu dokument…", icon: "📖" },
    getAdvisory: { label: "Připravuji doporučení…", icon: "💡" },
    findDiscounts: { label: "Hledám slevy na trhu…", icon: "🔥" },
    analyzeMarket: { label: "Analyzuji trh…", icon: "📊" },
    getMarketNews: { label: "Načítám zprávy z trhu…", icon: "📰" },
  }

  const toolInfo = TOOL_LABELS[toolName] || { label: "Zpracovávám…", icon: "⚙️" }

  if (state === "input-streaming" || state === "input-available") {
    return (
      <div className="flex items-center gap-2 py-1.5 px-3 rounded-full bg-emerald-50 border border-emerald-200 w-fit text-[12px] font-medium text-emerald-700 animate-pulse">
        <span>{toolInfo.icon}</span>
        <span>{toolInfo.label}</span>
      </div>
    )
  }

  if (state === "output-error") {
    return (
      <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-600">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>Chyba: {errorText || "Neznámá chyba"}</span>
      </div>
    )
  }

  if (state === "output-available" && output !== undefined) {
    switch (toolName) {
      case "generateChart":
        return <ChartRenderer output={output} />
      case "draftEmail":
        return <EmailRenderer output={output} />
      case "auditProperties":
        return <AuditRenderer output={output} />
      case "generateReport":
        return <ReportRenderer output={output} />
      case "getMonitoring":
        return <MonitoringRenderer output={output} />
      case "getCalendar":
        return <CalendarRenderer output={output} />
      case "readEmails":
        return <ReadEmailsRenderer output={output} />
      case "sendGmail":
        return <SendGmailRenderer output={output} />
      case "getNotes":
        return <NotesRenderer output={output} />
      case "createNote":
        return <CreateNoteRenderer output={output} />
      case "analyzeUpload":
        return <AnalyzeUploadRenderer output={output} />
      case "searchRealEstate":
        return <SearchRealEstateRenderer output={output} />
      case "searchDocuments":
        return <SearchDocumentsRenderer output={output} />
      case "findDiscounts":
        return <FindDiscountsRenderer output={output} />
      case "getMarketNews":
        return <MarketNewsRenderer output={output} />
      case "queryClients":
      case "queryProperties":
      case "queryLeadsAndSales":
        return <DataTableRenderer toolName={toolName} output={output} />
      default:
        return null
    }
  }

  return null
}
