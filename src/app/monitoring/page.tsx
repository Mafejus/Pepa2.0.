"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import type { MonitoringResult } from "@/lib/data/monitoring"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "@/lib/toast"
import {
  Bot,
  ArrowRight,
  ExternalLink,
  Plus,
  Bell,
  Settings,
  RefreshCw,
  MapPin,
  Ruler,
  Building2,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

interface AiScore {
  id: string
  aiScore: number
  aiTags: string[]
  aiDoporuceni: string
}

type MonitoringResultWithAI = MonitoringResult & Partial<AiScore>

type SortMode = "ai" | "newest" | "cheapest" | "expensive" | "price_m2"

// ──────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────

type ServerId = MonitoringResult["server"]
type Tab = "all" | "slevy" | ServerId

const LOKALITY = [
  { value: "praha-7-holesovice", label: "Praha 7 – Holešovice" },
  { value: "praha",              label: "Praha (celá)" },
  { value: "brno",               label: "Brno" },
  { value: "plzen",              label: "Plzeň" },
]

const SERVERS: {
  id: Tab
  label: string
  color: string
  dot: string
  bg: string
  border: string
}[] = [
  { id: "all",         label: "Vše",           color: "text-slate-700",   dot: "bg-slate-400",   bg: "bg-slate-100",   border: "border-slate-200" },
  { id: "sreality",    label: "Sreality",       color: "text-blue-700",    dot: "bg-blue-400",    bg: "bg-blue-50",     border: "border-blue-200" },
  { id: "bezrealitky", label: "Bezrealitky",    color: "text-emerald-700", dot: "bg-emerald-400", bg: "bg-emerald-50",  border: "border-emerald-200" },
  { id: "idnes",       label: "iDnes Reality",  color: "text-orange-700",  dot: "bg-orange-400",  bg: "bg-orange-50",   border: "border-orange-200" },
  { id: "realitymix",  label: "RealityMix",     color: "text-violet-700",  dot: "bg-violet-400",  bg: "bg-violet-50",   border: "border-violet-200" },
  { id: "bazos",       label: "Bazoš",          color: "text-rose-700",    dot: "bg-rose-400",    bg: "bg-rose-50",     border: "border-rose-200" },
]

function getServerCfg(id: Tab) {
  return SERVERS.find((s) => s.id === id) ?? SERVERS[0]
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function formatPrice(price: number): string {
  if (!price || price < 1000) return "Cena na vyžádání"
  if (price >= 1_000_000) {
    const val = price / 1_000_000
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} mil. Kč`
  }
  return `${price.toLocaleString("cs-CZ")} Kč`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) {
    return `dnes ${d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" })}`
  }
  return d.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })
}

// ──────────────────────────────────────────────
// SKELETON
// ──────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden animate-pulse">
      <div className="h-2 bg-slate-100 w-full" />
      <div className="px-3 py-2.5 border-b border-slate-50 flex items-center gap-2">
        <div className="h-4 w-16 rounded-full bg-slate-100" />
        <div className="ml-auto h-3 w-10 rounded bg-slate-100" />
      </div>
      <div className="px-3 py-3 flex flex-col gap-2.5">
        <div className="h-3.5 w-full rounded bg-slate-100" />
        <div className="h-3.5 w-3/4 rounded bg-slate-100" />
        <div className="h-3 w-1/2 rounded bg-slate-100 mt-1" />
        <div className="h-5 w-28 rounded bg-slate-100 mt-1" />
      </div>
      <div className="px-3 py-2.5 border-t border-slate-50 flex items-center gap-2">
        <div className="h-3 w-20 rounded bg-slate-100" />
        <div className="ml-auto h-6 w-24 rounded-lg bg-slate-100" />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// AI SCORE BADGE
// ──────────────────────────────────────────────

function AiScoreBadge({ score }: { score: number }) {
  if (score >= 70) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-700">
        <Sparkles className="h-2.5 w-2.5" />
        AI doporučuje
      </span>
    )
  }
  if (score >= 50) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
        Zajímavé
      </span>
    )
  }
  return null
}

// ──────────────────────────────────────────────
// OFFER CARD (live results)
// ──────────────────────────────────────────────

function OfferCard({ result, aiAnalyzing }: { result: MonitoringResultWithAI; aiAnalyzing: boolean }) {
  const srv = getServerCfg(result.server)
  const [added, setAdded] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const hasAi = result.aiScore !== undefined
  const isTop = (result.aiScore ?? 0) >= 70
  const isGood = (result.aiScore ?? 0) >= 50

  const handleAdd = () => {
    if (added) return
    setAdded(true)
    const short = result.nazev.length > 40 ? result.nazev.slice(0, 40) + "…" : result.nazev
    toast(`„${short}" přidáno do CRM`)
  }

  return (
    <div className={cn(
      "rounded-xl border bg-white shadow-sm hover:shadow-md transition-all duration-150 flex flex-col overflow-hidden",
      isTop ? "border-amber-300 ring-1 ring-amber-200" : isGood ? "border-emerald-200" : "border-slate-200 hover:border-slate-300"
    )}>
      {/* Thumbnail */}
      {result.obrazek && (
        <div className="relative h-32 overflow-hidden bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.obrazek}
            alt={result.nazev}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const parent = e.currentTarget.parentElement
              if (parent) parent.style.display = "none"
            }}
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-50 flex-wrap gap-y-1">
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
          srv.bg, srv.color,
        )}>
          <span className={cn("h-1.5 w-1.5 rounded-full", srv.dot)} />
          {srv.label}
        </span>

        {result.novinka && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-600">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            NOVÉ
          </span>
        )}

        {hasAi && <AiScoreBadge score={result.aiScore!} />}

        {aiAnalyzing && !hasAi && (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-400 animate-pulse">
            <Sparkles className="h-2.5 w-2.5" />
            AI…
          </span>
        )}

        <span className="ml-auto text-[10px] text-slate-400">{formatTime(result.datumNalezeni)}</span>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 px-3 py-3 flex-1">
        <h3 className="text-[13px] font-semibold text-slate-800 leading-snug line-clamp-2">
          {result.nazev}
        </h3>

        <div className="flex items-center gap-1 text-[11px] text-slate-500">
          <MapPin className="h-3 w-3 shrink-0" />
          <span>{result.lokalita}</span>
        </div>

        {(result.plocha > 0 || result.dispozice) && (
          <div className="flex items-center gap-3 text-[11px] text-slate-600">
            {result.plocha > 0 && (
              <span className="flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                {result.plocha} m²
              </span>
            )}
            {result.plocha > 0 && result.dispozice && <span className="text-slate-300">·</span>}
            {result.dispozice && <span>{result.dispozice}</span>}
            {result.plocha > 0 && result.cena > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-400">{Math.round(result.cena / result.plocha).toLocaleString("cs-CZ")} Kč/m²</span>
              </>
            )}
          </div>
        )}

        <div className="mt-auto pt-1 flex items-center gap-2 flex-wrap">
          {result.jeSleva ? (
            <>
              <span className="text-[15px] font-bold text-emerald-600">{formatPrice(result.cena)}</span>
              {result.slevaProcent && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">
                  −{result.slevaProcent} %
                </span>
              )}
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">🔥 SLEVA</span>
            </>
          ) : (
            <span className="text-[15px] font-bold text-slate-900">{formatPrice(result.cena)}</span>
          )}
        </div>

        {/* AI tags */}
        {hasAi && result.aiTags && result.aiTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {result.aiTags.map((tag) => (
              <span key={tag} className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* AI doporuceni expandable */}
        {hasAi && result.aiDoporuceni && (
          <div className="mt-1">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>Hodnoceno AI</span>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {expanded && (
              <p className="mt-1.5 text-[12px] text-slate-600 leading-relaxed rounded-lg bg-amber-50/60 border border-amber-100 px-3 py-2">
                {result.aiDoporuceni}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-slate-50">
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Otevřít inzerát
        </a>
        <button
          onClick={handleAdd}
          disabled={added}
          className={cn(
            "ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all",
            added
              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
              : "bg-slate-900 text-white hover:bg-slate-700",
          )}
        >
          {added ? (
            <><CheckCircle2 className="h-3 w-3" />Přidáno</>
          ) : (
            <><Plus className="h-3 w-3" />Přidat do CRM</>
          )}
        </button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// FALLBACK CARD
// ──────────────────────────────────────────────

function FallbackCard({ result }: { result: MonitoringResult }) {
  const srv = getServerCfg(result.server)
  return (
    <a
      href={result.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "rounded-xl border flex flex-col overflow-hidden hover:shadow-md transition-all duration-150 group",
        srv.bg, srv.border,
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/60">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-white/70", srv.color)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", srv.dot)} />
          {srv.label}
        </span>
        <span className="ml-auto inline-flex items-center rounded-full bg-white/70 border border-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          Přímý odkaz
        </span>
      </div>
      <div className="flex flex-col gap-3 px-3 py-5 flex-1 items-center justify-center text-center">
        <ExternalLink className={cn("h-5 w-5", srv.color)} />
        <div>
          <div className={cn("text-[13px] font-semibold", srv.color)}>Klikněte pro zobrazení nabídek na {srv.label}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Byty k prodeji · živé výsledky</div>
        </div>
        <div className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium border bg-white/70 group-hover:bg-white transition-colors", srv.color, srv.border)}>
          Hledat na {srv.label}
          <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </a>
  )
}

// ──────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<Tab>("all")
  const [showNewOnly, setShowNewOnly] = useState(false)
  const [lokalita, setLokalita] = useState("praha-7-holesovice")
  const [results, setResults] = useState<MonitoringResultWithAI[]>([])
  const [serverStatus, setServerStatus] = useState<Record<string, { live: boolean; count: number }>>({})
  const [loading, setLoading] = useState(true)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const [aiAnalyzing, setAiAnalyzing] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>("ai")

  // Fetch monitoring data, then trigger AI analysis
  const fetchData = useCallback(async (loc: string, nocache = false) => {
    setLoading(true)
    setResults([])
    try {
      const url = `/api/monitoring-live?lokalita=${loc}${nocache ? "&nocache=1" : ""}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const rawResults: MonitoringResult[] = data.results ?? []
      setResults(rawResults)
      setServerStatus(data.serverStatus ?? {})
      setFetchedAt(data.fetchedAt ?? new Date().toISOString())

    } catch {
      // keep existing results
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const analyzeWithAI = useCallback(async (allResults: MonitoringResult[], liveResults: MonitoringResult[]) => {
    try {
      const res = await fetch("/api/monitoring-live/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results: liveResults }),
      })
      if (!res.ok) return
      const data = await res.json()
      const scores: AiScore[] = data.scores ?? []

      // Merge AI scores back into results
      setResults(
        allResults.map((r) => {
          const ai = scores.find((s) => s.id === r.id)
          return ai ? { ...r, ...ai } : r
        })
      )
    } catch {
      // silently ignore — cards just won't show AI data
    } finally {
      setAiAnalyzing(false)
    }
  }, [])

  useEffect(() => {
    fetchData(lokalita)
  }, [fetchData, lokalita])

  // Per-tab counts
  const tabCounts = useMemo(() => {
    const counts: Record<Tab, number> = { all: 0, slevy: 0, sreality: 0, bezrealitky: 0, idnes: 0, realitymix: 0, bazos: 0 }
    for (const r of results) {
      if (!r.jeFallback) {
        counts[r.server] = (counts[r.server] ?? 0) + 1
        counts.all++
        if (r.jeSleva) counts.slevy++
      }
    }
    return counts
  }, [results])

  const newCount = useMemo(() => results.filter((r) => r.novinka && !r.jeFallback).length, [results])
  const aiRecommendedCount = useMemo(() => results.filter((r) => (r.aiScore ?? 0) >= 70).length, [results])

  // Filtered + sorted results
  const filtered = useMemo(() => {
    let list: MonitoringResultWithAI[] =
      activeTab === "all" ? results
      : activeTab === "slevy" ? results.filter((r) => r.jeSleva)
      : results.filter((r) => r.server === activeTab)
    if (showNewOnly) list = list.filter((r) => r.novinka)

    const live = list.filter((r) => !r.jeFallback)
    const fallback = list.filter((r) => r.jeFallback)

    const sorted = [...live].sort((a, b) => {
      switch (sortMode) {
        case "ai":      return (b.aiScore ?? 0) - (a.aiScore ?? 0)
        case "newest":  return new Date(b.datumNalezeni).getTime() - new Date(a.datumNalezeni).getTime()
        case "cheapest": return (a.cena || Infinity) - (b.cena || Infinity)
        case "expensive": return (b.cena || 0) - (a.cena || 0)
        case "price_m2": {
          const apm = a.plocha > 0 ? a.cena / a.plocha : Infinity
          const bpm = b.plocha > 0 ? b.cena / b.plocha : Infinity
          return apm - bpm
        }
        default: return 0
      }
    })

    return { live: sorted, fallback }
  }, [results, activeTab, showNewOnly, sortMode])

  // Price stats
  const stats = useMemo(() => {
    const prices = filtered.live.map((r) => r.cena).filter((p) => p > 0)
    if (prices.length === 0) return null
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
    }
  }, [filtered.live])

  const liveServers = Object.entries(serverStatus).filter(([, s]) => s.live).map(([name]) => name)
  const totalLive = Object.values(serverStatus).reduce((s, v) => s + (v.live ? v.count : 0), 0)
  const lokalitaLabel = LOKALITY.find((l) => l.value === lokalita)?.label ?? lokalita

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900 leading-tight">Monitoring</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">
            Sledování nových nabídek — {lokalitaLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fetchedAt && !loading && (
            <span className="text-[11px] text-slate-400">{formatTimestamp(fetchedAt)}</span>
          )}
          <button
            onClick={() => fetchData(lokalita, true)}
            disabled={loading}
            className="flex items-center gap-1.5 text-[12px] text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Obnovit
          </button>
        </div>
      </div>

      {/* Locality selector */}
      <div className="flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <span className="text-[12px] text-slate-500">Lokalita:</span>
        <Select
          value={lokalita}
          onValueChange={(v) => { if (v) { setLokalita(v); setActiveTab("all") } }}
        >
          <SelectTrigger className="h-7 text-[12px] w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOKALITY.map((l) => (
              <SelectItem key={l.value} value={l.value} className="text-[12px]">{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Bell className="h-4 w-4 text-red-500" />
          <span className="text-[12px] font-semibold text-slate-700">{newCount} nových</span>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <Building2 className="h-4 w-4 text-slate-400" />
          <span className="text-[12px] text-slate-600">
            {loading ? "…" : `${totalLive} nabídek celkem`}
          </span>
          {!loading && liveServers.length > 0 && (
            <span className="text-[11px] text-slate-400">
              ({liveServers.map((s) => `${s}: ${serverStatus[s].count}`).join(", ")})
            </span>
          )}
        </div>

        {/* AI analyze button + status badge */}
        {aiAnalyzing ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 animate-pulse">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-[12px] font-semibold text-amber-700">🤖 AI analyzuje nabídky…</span>
          </div>
        ) : aiRecommendedCount > 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-[12px] font-semibold text-amber-700">⭐ AI doporučuje: {aiRecommendedCount} nemovitostí</span>
          </div>
        ) : (
          <button
            onClick={() => {
              const liveOnly = results.filter((r) => !r.jeFallback)
              if (liveOnly.length > 0) {
                setAiAnalyzing(true)
                analyzeWithAI(results, liveOnly)
              }
            }}
            disabled={loading || results.filter((r) => !r.jeFallback).length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Analyzovat AI
          </button>
        )}

        {stats && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 flex-wrap gap-y-1">
            <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-[12px] text-slate-600">od {formatPrice(stats.min)}</span>
            <span className="text-slate-300">·</span>
            <TrendingUp className="h-3.5 w-3.5 text-orange-400" />
            <span className="text-[12px] text-slate-600">do {formatPrice(stats.max)}</span>
            <span className="text-slate-300">·</span>
            <span className="text-[12px] text-slate-500">ø {formatPrice(stats.avg)}</span>
          </div>
        )}
      </div>

      {/* Server tabs + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 flex-wrap">
          {SERVERS.map((srv) => {
            const count = loading ? null : (srv.id === "all" ? tabCounts.all : tabCounts[srv.id as ServerId])
            return (
              <button
                key={srv.id}
                onClick={() => setActiveTab(srv.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-all",
                  activeTab === srv.id ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50",
                )}
              >
                {srv.id !== "all" && <span className={cn("h-1.5 w-1.5 rounded-full", srv.dot)} />}
                {srv.label}
                {count !== null && (
                  <span className={cn("ml-0.5 text-[10px]", activeTab === srv.id ? "text-white/60" : "text-slate-400")}>
                    ({count})
                  </span>
                )}
              </button>
            )
          })}
          {tabCounts.slevy > 0 && (
            <button
              onClick={() => setActiveTab("slevy")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-all",
                activeTab === "slevy" ? "bg-red-600 text-white shadow-sm" : "text-red-600 hover:bg-red-50",
              )}
            >
              🔥 Ve slevě
              <span className={cn("ml-0.5 text-[10px]", activeTab === "slevy" ? "text-white/60" : "text-red-400")}>
                ({tabCounts.slevy})
              </span>
            </button>
          )}
        </div>

        {/* Sort select */}
        <Select value={sortMode} onValueChange={(v) => v && setSortMode(v as SortMode)}>
          <SelectTrigger className="h-7 text-[12px] w-44 border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ai" className="text-[12px]">⭐ AI doporučení</SelectItem>
            <SelectItem value="newest" className="text-[12px]">🕐 Nejnovější</SelectItem>
            <SelectItem value="cheapest" className="text-[12px]">💰 Nejlevnější</SelectItem>
            <SelectItem value="expensive" className="text-[12px]">💎 Nejdražší</SelectItem>
            <SelectItem value="price_m2" className="text-[12px]">📐 Cena za m²</SelectItem>
          </SelectContent>
        </Select>

        {/* New only toggle */}
        <button
          onClick={() => setShowNewOnly(!showNewOnly)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all",
            showNewOnly ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", showNewOnly ? "bg-red-500 animate-pulse" : "bg-slate-400")} />
          Pouze nové
          {showNewOnly && newCount > 0 && (
            <span className="ml-1 rounded-full bg-red-100 px-1.5 text-[10px] text-red-600">{newCount}</span>
          )}
        </button>

        <span className="ml-auto text-[11px] text-slate-400">
          {loading
            ? "Načítám…"
            : `${filtered.live.length + filtered.fallback.length} ${
                filtered.live.length + filtered.fallback.length === 1 ? "výsledek"
                : filtered.live.length + filtered.fallback.length < 5 ? "výsledky" : "výsledků"
              }`}
        </span>
      </div>

      {/* Results grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : filtered.live.length === 0 && filtered.fallback.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bell className="h-8 w-8 text-slate-300 mb-3" />
          <p className="text-[13px] text-slate-400">Žádné nabídky pro zvolený filtr</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.live.map((r) => (
            <OfferCard key={r.id} result={r} aiAnalyzing={aiAnalyzing} />
          ))}
          {filtered.fallback.map((r) => (
            <FallbackCard key={r.id} result={r} />
          ))}
        </div>
      )}

      {/* Settings card */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 flex items-center gap-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          <Settings className="h-4 w-4 text-slate-500" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-slate-800">Nastavení monitoringu</div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Lokalita: {lokalitaLabel} · Servery: Sreality, Bezrealitky, iDnes, RealityMix, Bazoš · AI scoring: claude-sonnet-4
          </div>
        </div>
        <button
          onClick={() => toast("Nastavení monitoringu uloženo")}
          className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors border border-slate-200 rounded-lg px-3 py-1.5 hover:border-slate-300"
        >
          Uložit
        </button>
      </div>

      {/* CTA */}
      <Link
        href="/agent"
        className="group flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 hover:bg-emerald-100 transition-colors"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <Bot className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-slate-800">Analyzovat trh s Pepou</div>
          <div className="text-[11px] text-slate-500">Porovnej ceny, trendy a vyhodnoť konkurenční nabídky</div>
        </div>
        <ArrowRight className="h-4 w-4 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
      </Link>
    </div>
  )
}
