"use client"

import { useState } from "react"
import { Lightbulb, TrendingUp, TrendingDown, Minus, Loader2, RefreshCw, BarChart3, Newspaper, ChevronRight, ExternalLink, AlertCircle } from "lucide-react"

// ── Types ────────────────────────────────────────────────────────────────────

interface BuyRecommendation {
  id: string
  nazev: string
  cena: number
  lokalita: string
  url: string
  duvod: string
  investicniPotencial: "vysoky" | "stredni" | "nizky"
  doporuceniAkce: string
}

interface SellRecommendation {
  propertyId: string
  nazev: string
  aktualniCena: number
  odhadTrzniCena: number
  doporuceni: "prodat" | "drzet" | "snizit_cenu"
  duvod: string
  urgence: "vysoká" | "střední" | "nízká"
}

interface MarketAnalysis {
  prumerneCeny: Record<string, number>
  trend: "rust" | "pokles" | "stabilni"
  trendPopis: string
  topLokality: Array<{ nazev: string; cenaPrumer: number }>
  investicniDoporuceni: string
  celkovaAnalyza: string
}

interface NewsItem {
  titulek: string
  zdroj: string
  datum: string
  shrnutí: string
  url: string
  sentiment: "pozitivni" | "negativni" | "neutralni"
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(n: number): string {
  if (!n) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".0", "")} mil. Kč`
  return `${n.toLocaleString("cs-CZ")} Kč`
}

function PotencialBadge({ p }: { p: string }) {
  const map = {
    vysoky: "bg-emerald-100 text-emerald-700",
    stredni: "bg-amber-100 text-amber-700",
    nizky: "bg-slate-100 text-slate-500",
  }
  const labels = { vysoky: "Vysoký potenciál", stredni: "Střední potenciál", nizky: "Nízký potenciál" }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[p as keyof typeof map] ?? map.stredni}`}>
      {labels[p as keyof typeof labels] ?? p}
    </span>
  )
}

function DoporuceniBadge({ d }: { d: string }) {
  const map = {
    prodat: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    drzet: "bg-slate-100 text-slate-600 border border-slate-200",
    snizit_cenu: "bg-amber-100 text-amber-700 border border-amber-200",
  }
  const labels = { prodat: "✅ Prodat", drzet: "⏸ Držet", snizit_cenu: "📉 Snížit cenu" }
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${map[d as keyof typeof map] ?? map.drzet}`}>
      {labels[d as keyof typeof labels] ?? d}
    </span>
  )
}

function SentimentIcon({ s }: { s: string }) {
  if (s === "pozitivni") return <TrendingUp className="h-4 w-4 text-emerald-500" />
  if (s === "negativni") return <TrendingDown className="h-4 w-4 text-red-500" />
  return <Minus className="h-4 w-4 text-slate-400" />
}

const TABS = [
  { id: "buy", label: "💰 Koupit", icon: TrendingUp },
  { id: "sell", label: "🏷️ Prodat", icon: TrendingDown },
  { id: "market", label: "📊 Trh", icon: BarChart3 },
  { id: "news", label: "📰 Zprávy", icon: Newspaper },
]

const CITIES = ["Praha", "Brno", "Plzeň", "Ostrava", "Hradec Králové", "Liberec", "Česko"]

// ── localStorage helpers ──────────────────────────────────────────────────────

function lsGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try { return JSON.parse(localStorage.getItem(key) ?? "null") } catch { return null }
}

function lsSet(key: string, value: unknown) {
  if (typeof window === "undefined") return
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PoradcePage() {
  const [activeTab, setActiveTab] = useState("buy")

  // Buy state
  const [buyData, setBuyData] = useState<BuyRecommendation[] | null>(() => lsGet("poradce_buy_data"))
  const [buyLoading, setBuyLoading] = useState(false)
  const [buyError, setBuyError] = useState<string | null>(null)
  const [buyCity, setBuyCity] = useState(() => lsGet<string>("poradce_buy_city") ?? "praha")
  const [buyCelkem, setBuyCelkem] = useState<number | null>(() => lsGet("poradce_buy_celkem"))

  // Sell state
  const [sellData, setSellData] = useState<SellRecommendation[] | null>(() => lsGet("poradce_sell_data"))
  const [sellLoading, setSellLoading] = useState(false)
  const [sellError, setSellError] = useState<string | null>(null)

  // Market state
  const [marketData, setMarketData] = useState<MarketAnalysis | null>(() => lsGet("poradce_market_data"))
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError, setMarketError] = useState<string | null>(null)
  const [marketCity, setMarketCity] = useState(() => lsGet<string>("poradce_market_city") ?? "Praha")
  const [marketBasis, setMarketBasis] = useState<number | null>(() => lsGet("poradce_market_basis"))

  // News state
  const [newsData, setNewsData] = useState<NewsItem[] | null>(() => lsGet("poradce_news_data"))
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [newsCity, setNewsCity] = useState(() => lsGet<string>("poradce_news_city") ?? "Česko")

  async function loadBuy(nocache = false) {
    setBuyLoading(true); setBuyError(null)
    try {
      const params = new URLSearchParams({ lokalita: buyCity })
      if (nocache) params.set("nocache", "1")
      const res = await fetch(`/api/ai-advisor/buy?${params}`)
      const data = await res.json()
      if (data.error && !data.recommendations?.length) throw new Error(data.error)
      const recs = data.recommendations ?? []
      const celkem = data.celkemNabidek ?? null
      setBuyData(recs)
      setBuyCelkem(celkem)
      lsSet("poradce_buy_data", recs)
      lsSet("poradce_buy_celkem", celkem)
      lsSet("poradce_buy_city", buyCity)
    } catch (e) { setBuyError(String(e)) }
    finally { setBuyLoading(false) }
  }

  async function loadSell() {
    setSellLoading(true); setSellError(null)
    try {
      const res = await fetch("/api/ai-advisor/sell")
      const data = await res.json()
      if (data.error && !data.recommendations?.length) throw new Error(data.error)
      const recs = data.recommendations ?? []
      setSellData(recs)
      lsSet("poradce_sell_data", recs)
    } catch (e) { setSellError(String(e)) }
    finally { setSellLoading(false) }
  }

  async function loadMarket(nocache = false) {
    setMarketLoading(true); setMarketError(null)
    try {
      const params = new URLSearchParams({ lokalita: marketCity })
      if (nocache) params.set("nocache", "1")
      const res = await fetch(`/api/market-analysis?${params}`)
      const data = await res.json()
      if (data.error && !data.analysis) throw new Error(data.error)
      const basis = data.dataBasis ?? null
      setMarketData(data.analysis)
      setMarketBasis(basis)
      lsSet("poradce_market_data", data.analysis)
      lsSet("poradce_market_basis", basis)
      lsSet("poradce_market_city", marketCity)
    } catch (e) { setMarketError(String(e)) }
    finally { setMarketLoading(false) }
  }

  async function loadNews() {
    setNewsLoading(true); setNewsError(null)
    try {
      const res = await fetch(`/api/market-news?lokalita=${encodeURIComponent(newsCity)}`)
      const data = await res.json()
      if (data.error && !data.news?.length) throw new Error(data.error)
      const news = data.news ?? []
      setNewsData(news)
      lsSet("poradce_news_data", news)
      lsSet("poradce_news_city", newsCity)
    } catch (e) { setNewsError(String(e)) }
    finally { setNewsLoading(false) }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 shadow-sm">
            <Lightbulb className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">AI Poradce</h1>
            <p className="text-sm text-slate-500">Doporučení ke koupi, prodeji a analýza trhu</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${activeTab === tab.id ? "bg-amber-500 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* BUY TAB */}
        {activeTab === "buy" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Doporučení ke koupi</h2>
                <p className="text-sm text-slate-500">AI vybere top 5 nemovitostí z aktuálních dat monitoringu</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={buyCity}
                  onChange={(e) => setBuyCity(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
                >
                  <option value="praha">Praha</option>
                  <option value="praha-7-holesovice">Praha 7 – Holešovice</option>
                  <option value="brno">Brno</option>
                  <option value="plzen">Plzeň</option>
                </select>
                <button
                  onClick={() => loadBuy(true)}
                  disabled={buyLoading}
                  className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                >
                  {buyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {buyLoading ? "AI analyzuje nabídky…" : "Analyzovat trh"}
                </button>
              </div>
            </div>

            {buyCelkem !== null && !buyLoading && (
              <p className="text-[12px] text-slate-400">Analýza z {buyCelkem} aktuálních nabídek na trhu</p>
            )}

            {buyError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {buyError}
              </div>
            )}

            {!buyData && !buyLoading && !buyError && (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
                <TrendingUp className="mb-3 h-10 w-10 text-slate-200" />
                <p className="text-sm font-medium text-slate-500">Vyberte lokalitu a spusťte analýzu</p>
                <p className="mt-1 text-xs text-slate-400">AI použije živá data z monitoringu a vybere nejzajímavější nabídky</p>
              </div>
            )}

            {buyData && buyData.length > 0 && (
              <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 transition-opacity ${buyLoading ? "opacity-40 pointer-events-none" : ""}`}>
                {buyData.map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <p className="font-semibold text-slate-900 leading-snug">{r.nazev}</p>
                      <PotencialBadge p={r.investicniPotencial} />
                    </div>
                    <div className="text-2xl font-bold text-emerald-600 mb-1">{formatPrice(r.cena)}</div>
                    <div className="text-[12px] text-slate-400 mb-3">{r.lokalita}</div>
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 mb-3">
                      <p className="text-[12px] text-emerald-800 leading-relaxed">{r.duvod}</p>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3 italic">{r.doporuceniAkce}</p>
                    {r.url && r.url !== "#" && (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700">
                        <ExternalLink className="h-3.5 w-3.5" /> Zobrazit inzerát
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SELL TAB */}
        {activeTab === "sell" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Doporučení k prodeji</h2>
                <p className="text-sm text-slate-500">AI analyzuje vaše portfolio a doporučí prodejní strategii</p>
              </div>
              <button
                onClick={loadSell}
                disabled={sellLoading}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {sellLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {sellLoading ? "AI analyzuje portfolio…" : "Analyzovat portfolio"}
              </button>
            </div>

            {sellError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Analýza dočasně nedostupná — {sellError}
              </div>
            )}

            {!sellData && !sellLoading && !sellError && (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
                <TrendingDown className="mb-3 h-10 w-10 text-slate-200" />
                <p className="text-sm font-medium text-slate-500">Klikněte pro analýzu vašeho portfolia</p>
              </div>
            )}

            {sellData && (
              <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-opacity ${sellLoading ? "opacity-40 pointer-events-none" : ""}`}>
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Nemovitost</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Naše cena</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tržní cena</th>
                      <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">Doporučení</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Urgence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sellData.map((r) => (
                      <tr
                        key={r.propertyId}
                        className={
                          r.doporuceni === "prodat"
                            ? "bg-emerald-50/30"
                            : r.doporuceni === "snizit_cenu"
                            ? "bg-amber-50/30"
                            : ""
                        }
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900">{r.nazev}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{r.duvod.slice(0, 80)}…</div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{formatPrice(r.aktualniCena)}</td>
                        <td className="px-4 py-3 text-right font-medium text-slate-700">{formatPrice(r.odhadTrzniCena)}</td>
                        <td className="px-4 py-3 text-center"><DoporuceniBadge d={r.doporuceni} /></td>
                        <td className="px-4 py-3 text-[12px] text-slate-600">{r.urgence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* MARKET TAB */}
        {activeTab === "market" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Analýza trhu</h2>
                <p className="text-sm text-slate-500">AI analýza aktuálního stavu realitního trhu</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={marketCity}
                  onChange={(e) => setMarketCity(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                >
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <button
                  onClick={() => loadMarket(true)}
                  disabled={marketLoading}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  {marketLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                  {marketLoading ? "Načítám data z trhu…" : "Analyzovat trh"}
                </button>
              </div>
            </div>

            {marketBasis !== null && !marketLoading && (
              <p className="text-[12px] text-slate-400">Analýza vychází z {marketBasis} aktuálních nabídek z monitoringu</p>
            )}

            {marketError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {marketError}
              </div>
            )}

            {!marketData && !marketLoading && !marketError && (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
                <BarChart3 className="mb-3 h-10 w-10 text-slate-200" />
                <p className="text-sm font-medium text-slate-500">Vyberte město a spusťte analýzu</p>
                <p className="mt-1 text-xs text-slate-400">Používá živá data z monitoringu realitních serverů</p>
              </div>
            )}

            {marketData && (
              <div className={`space-y-4 transition-opacity ${marketLoading ? "opacity-40 pointer-events-none" : ""}`}>
                {/* Trend indicator */}
                <div className={`flex items-center gap-3 rounded-xl border p-4 ${marketData.trend === "rust" ? "border-emerald-200 bg-emerald-50" : marketData.trend === "pokles" ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
                  {marketData.trend === "rust" ? <TrendingUp className="h-6 w-6 text-emerald-600" /> : marketData.trend === "pokles" ? <TrendingDown className="h-6 w-6 text-red-600" /> : <Minus className="h-6 w-6 text-slate-500" />}
                  <div>
                    <div className="font-semibold text-slate-900">{marketData.trend === "rust" ? "Trh roste" : marketData.trend === "pokles" ? "Trh klesá" : "Trh stabilní"}</div>
                    <div className="text-sm text-slate-600">{marketData.trendPopis}</div>
                  </div>
                </div>

                {/* Average prices */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 font-semibold text-slate-900">Průměrné ceny bytů podle dispozice</h3>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {Object.entries(marketData.prumerneCeny).map(([dispo, cena]) => (
                      <div key={dispo} className="rounded-lg bg-slate-50 p-3 text-center">
                        <div className="text-[11px] text-slate-500 mb-1">{dispo}</div>
                        <div className="font-bold text-slate-900 text-lg">{formatPrice(cena)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI analysis */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 font-semibold text-slate-900">Celková analýza</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{marketData.celkovaAnalyza}</p>
                </div>

                {/* Investment recommendation */}
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-amber-900 mb-1">Investiční doporučení</h3>
                      <p className="text-sm text-amber-800 leading-relaxed">{marketData.investicniDoporuceni}</p>
                    </div>
                  </div>
                </div>

                {/* Top localities */}
                {marketData.topLokality?.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <h3 className="mb-3 font-semibold text-slate-900">Top lokality</h3>
                    <div className="space-y-2">
                      {marketData.topLokality.map((l, i) => (
                        <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700">{i + 1}</span>
                            <span className="text-sm font-medium text-slate-700">{l.nazev}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-900">{formatPrice(l.cenaPrumer)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* NEWS TAB */}
        {activeTab === "news" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Zprávy z trhu</h2>
                <p className="text-sm text-slate-500">AI přehled aktuálního dění na realitním trhu</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={newsCity}
                  onChange={(e) => setNewsCity(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-amber-400 focus:outline-none"
                >
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <button
                  onClick={loadNews}
                  disabled={newsLoading}
                  className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
                >
                  {newsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Newspaper className="h-4 w-4" />}
                  {newsLoading ? "AI hledá zprávy…" : "Načíst zprávy"}
                </button>
              </div>
            </div>

            {newsError && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Zprávy dočasně nedostupné
              </div>
            )}

            {!newsData && !newsLoading && !newsError && (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
                <Newspaper className="mb-3 h-10 w-10 text-slate-200" />
                <p className="text-sm font-medium text-slate-500">Vyberte lokalitu a načtěte zprávy</p>
              </div>
            )}

            {newsData && newsData.length > 0 && (
              <div className={`space-y-3 transition-opacity ${newsLoading ? "opacity-40 pointer-events-none" : ""}`}>
                {newsData.map((item, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0"><SentimentIcon s={item.sentiment} /></div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900 leading-snug">{item.titulek}</h3>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${item.sentiment === "pozitivni" ? "bg-emerald-100 text-emerald-700" : item.sentiment === "negativni" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}>
                            {item.sentiment === "pozitivni" ? "Pozitivní" : item.sentiment === "negativni" ? "Negativní" : "Neutrální"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mb-2">{item.zdroj} · {item.datum}</div>
                        <p className="text-[13px] text-slate-600 leading-relaxed">{item.shrnutí}</p>
                        {item.url && item.url !== "#" && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-[12px] font-medium text-blue-600 hover:text-blue-700">
                            Číst více <ChevronRight className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
