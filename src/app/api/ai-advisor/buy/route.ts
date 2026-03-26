import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import type { MonitoringResult } from "@/lib/data/monitoring"

export const maxDuration = 60

interface CachedResult { data: BuyRecommendation[]; ts: number }
const cache = new Map<string, CachedResult>()
const CACHE_TTL = 2 * 60 * 60 * 1000

interface BuyRecommendation {
  id: string
  nazev: string
  cena: number
  lokalita: string
  url: string
  plocha: number
  dispozice: string
  duvod: string
  investicniPotencial: "vysoky" | "stredni" | "nizky"
  doporuceniAkce: string
}

export async function GET(req: NextRequest) {
  const lokalita = req.nextUrl.searchParams.get("lokalita") ?? "praha"
  const nocache = req.nextUrl.searchParams.get("nocache") === "1"
  const cacheKey = lokalita

  if (!nocache) {
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ recommendations: cached.data, fromCache: true })
    }
  }

  try {
    // Use the app's own monitoring-live API — it has proven Sreality fetching + fallback
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")

    const res = await fetch(`${baseUrl}/api/monitoring-live?lokalita=${lokalita}&nocache=1`, {
      signal: AbortSignal.timeout(25_000),
      cache: "no-store",
    })

    if (!res.ok) throw new Error(`monitoring-live failed: HTTP ${res.status}`)
    const data = await res.json()

    const results: MonitoringResult[] = (data.results ?? []).filter(
      (r: MonitoringResult) => !r.jeFallback && r.cena >= 100_000
    )

    if (results.length === 0) {
      return NextResponse.json({ recommendations: [], error: "Žádné aktuální nabídky v databázi. Zkuste spustit monitoring nejprve." })
    }

    let parsed: BuyRecommendation[]
    try {
      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        system: "Jsi expert na český realitní trh a investice do nemovitostí. Odpovídej POUZE validním JSON arrayem bez dalšího textu. NEPIŠ nic jiného než JSON.",
        prompt: `Analyzuj tyto nabídky z ${lokalita} a vyber TOP 3 nejzajímavější k nákupu.

Nabídky (${results.length}):
${JSON.stringify(results.slice(0, 12).map((r) => ({
  id: r.id,
  nazev: r.nazev,
  cena: r.cena,
  plocha: r.plocha,
  dispozice: r.dispozice,
  lokalita: r.lokalita,
  cenaPerm2: r.plocha > 0 ? Math.round(r.cena / r.plocha) : null,
  url: r.url,
})), null, 2)}

Odpověz POUZE tímto JSON (max 3 položky, krátké texty):
[{"id":"...","nazev":"...","cena":0,"lokalita":"...","url":"...","plocha":0,"dispozice":"...","duvod":"1-2 věty","investicniPotencial":"vysoky","doporuceniAkce":"1 věta"}]`,
        maxOutputTokens: 4000,
      })

      const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()
      try {
        parsed = JSON.parse(cleaned) as BuyRecommendation[]
      } catch {
        const lastClose = cleaned.lastIndexOf("},")
        const recovered = lastClose > 0 ? cleaned.slice(0, lastClose + 1) + "]" : "[]"
        try {
          parsed = JSON.parse(recovered) as BuyRecommendation[]
        } catch {
          parsed = []
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[ai-advisor/buy] Claude API error:", msg)
      return NextResponse.json(
        { recommendations: [], error: "AI analýza dočasně nedostupná. Zkuste to za chvíli.", detail: msg },
        { status: 503 }
      )
    }

    // Merge back URLs from original results if Claude dropped them
    const recommendations: BuyRecommendation[] = parsed.map((r) => {
      const orig = results.find((res) => res.id === r.id)
      return {
        id: r.id,
        nazev: r.nazev || orig?.nazev || "",
        cena: r.cena || orig?.cena || 0,
        lokalita: r.lokalita || orig?.lokalita || "",
        url: orig?.url || r.url || "",
        plocha: r.plocha || orig?.plocha || 0,
        dispozice: r.dispozice || orig?.dispozice || "",
        duvod: r.duvod || "",
        investicniPotencial: r.investicniPotencial || "stredni",
        doporuceniAkce: r.doporuceniAkce || "",
      }
    })

    cache.set(cacheKey, { data: recommendations, ts: Date.now() })
    return NextResponse.json({ recommendations, celkemNabidek: results.length })
  } catch (err) {
    console.error("[ai-advisor/buy] error:", err)
    return NextResponse.json({ recommendations: [], error: String(err) }, { status: 500 })
  }
}
