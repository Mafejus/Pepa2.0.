import { NextResponse, NextRequest } from "next/server"
import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import type { MonitoringResult } from "@/lib/data/monitoring"

export const maxDuration = 60

interface CacheEntry { data: MarketAnalysis; ts: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 4 * 60 * 60 * 1000

interface MarketAnalysis {
  prumerneCeny: Record<string, number>
  trend: "rust" | "pokles" | "stabilni"
  trendPopis: string
  topLokality: Array<{ nazev: string; cenaPrumer: number }>
  investicniDoporuceni: string
  celkovaAnalyza: string
  dataBasis: number
}

// Map city names to monitoring-live slugs
const CITY_SLUG_MAP: Record<string, string> = {
  "Praha":         "praha",
  "Praha (celá)":  "praha",
  "Brno":          "brno",
  "Plzeň":         "plzen",
  "Plzen":         "plzen",
  "Ostrava":       "praha", // fallback
  "Česko":         "praha",
  "Cesko":         "praha",
}

function cityToSlug(city: string): string {
  return CITY_SLUG_MAP[city] ?? city.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
}

export async function GET(req: NextRequest) {
  const lokalita = req.nextUrl.searchParams.get("lokalita") ?? "Praha"
  const nocache = req.nextUrl.searchParams.get("nocache") === "1"
  const cacheKey = lokalita.toLowerCase()

  if (!nocache) {
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ analysis: cached.data, fromCache: true, lokalita })
    }
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    const slug = cityToSlug(lokalita)
    const res = await fetch(`${baseUrl}/api/monitoring-live?lokalita=${slug}&nocache=1`, {
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    })

    if (!res.ok) throw new Error(`monitoring-live failed: HTTP ${res.status}`)
    const data = await res.json()

    const results: MonitoringResult[] = (data.results ?? []).filter(
      (r: MonitoringResult) => !r.jeFallback && r.cena >= 100_000
    )

    if (results.length === 0) {
      return NextResponse.json({ analysis: null, error: "Žádná data pro tuto lokalitu. Spusťte nejprve monitoring.", lokalita })
    }

    // Pre-compute statistics to help Claude
    const withPlocha = results.filter((r) => r.plocha > 0)
    const pricePerM2 = withPlocha.map((r) => ({ ...r, cenaM2: Math.round(r.cena / r.plocha) }))
    const avgPrice = Math.round(results.reduce((s, r) => s + r.cena, 0) / results.length)
    const avgM2 = pricePerM2.length > 0
      ? Math.round(pricePerM2.reduce((s, r) => s + r.cenaM2, 0) / pricePerM2.length)
      : 0
    const slevyCount = results.filter((r) => (r as MonitoringResult & { jeSleva?: boolean }).jeSleva).length

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: "Jsi analytik realitního trhu v ČR. Pracuješ s reálnými daty z realitních serverů. Odpovídej POUZE validním JSON objektem.",
      prompt: `Proveď analýzu realitního trhu pro lokalitu "${lokalita}" na základě REÁLNÝCH aktuálních dat z realitních serverů.

Statistiky dat:
- Počet nabídek: ${results.length}
- Průměrná cena: ${avgPrice.toLocaleString("cs-CZ")} Kč
- Průměrná cena/m²: ${avgM2.toLocaleString("cs-CZ")} Kč/m²
- Počet zlevněných: ${slevyCount}
- Servery: ${[...new Set(results.map((r) => r.server))].join(", ")}

Detailní nabídky (${Math.min(results.length, 50)} z ${results.length}):
${JSON.stringify(results.slice(0, 50).map((r) => ({
  nazev: r.nazev,
  cena: r.cena,
  plocha: r.plocha,
  dispozice: r.dispozice,
  lokalita: r.lokalita,
  cenaPerm2: r.plocha > 0 ? Math.round(r.cena / r.plocha) : null,
})), null, 2)}

Analyzuj tato REÁLNÁ data a vrať JSON:
{
  "prumerneCeny": {
    "1+kk": průměrná cena pro 1+kk z dat (nebo odhad),
    "2+kk": průměrná cena pro 2+kk,
    "3+kk": průměrná cena pro 3+kk,
    "4+kk": průměrná cena pro 4+kk
  },
  "trend": "rust"|"pokles"|"stabilni",
  "trendPopis": "2-3 věty o trendu na základě dat — počet nabídek, podíl slev, cenové hladiny",
  "topLokality": [{ "nazev": "konkrétní lokalita/čtvrť z dat", "cenaPrumer": průměrná cena }],
  "investicniDoporuceni": "konkrétní doporučení pro investory na základě dat",
  "celkovaAnalyza": "4-5 vět analýzy — co data říkají o trhu, jaké jsou cenové hladiny, co to znamená pro kupce/prodejce"
}

ODPOVĚZ POUZE JSON OBJEKTEM.`,
      maxOutputTokens: 1500,
    })

    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()
    const analysis: MarketAnalysis = { ...JSON.parse(cleaned), dataBasis: results.length }

    cache.set(cacheKey, { data: analysis, ts: Date.now() })
    return NextResponse.json({ analysis, lokalita, dataBasis: results.length })
  } catch (err) {
    return NextResponse.json({ analysis: null, error: String(err), lokalita }, { status: 500 })
  }
}
