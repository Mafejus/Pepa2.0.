import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import type { MonitoringResult } from "@/lib/data/monitoring"

export const maxDuration = 30

// ── 1-hour in-memory cache ─────────────────────────────────────────────────
interface CacheEntry {
  scores: AiScore[]
  ts: number
}

interface AiScore {
  id: string
  aiScore: number
  aiTags: string[]
  aiDoporuceni: string
}

const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

function getCacheKey(results: MonitoringResult[]): string {
  return results.map((r) => r.id).sort().join(",")
}

// ── Rule-based fallback ────────────────────────────────────────────────────
function ruleBasedScore(r: MonitoringResult): AiScore {
  let score = 50
  const tags: string[] = []

  if (r.cena > 0 && r.plocha > 0) {
    const pricePerM2 = r.cena / r.plocha
    if (pricePerM2 < 80_000) { score += 20; tags.push("Pod tržní cenou") }
    else if (pricePerM2 < 120_000) { score += 10; tags.push("Dobrá cena") }
    else if (pricePerM2 > 200_000) { score -= 15; tags.push("Prémiová cena") }
  }

  if (r.plocha > 80) { score += 10; tags.push("Velká plocha") }
  if (r.plocha > 0 && r.plocha < 40) score -= 10

  const lok = (r.lokalita ?? "").toLowerCase()
  if (lok.includes("vinohrady") || lok.includes("žižkov") || lok.includes("holešovice") || lok.includes("dejvice")) {
    score += 10; tags.push("Výborná lokalita")
  }

  if (r.dispozice?.includes("4") || r.dispozice?.includes("5")) { tags.push("Ideální pro rodiny") }

  if (r.novinka) { score += 5; tags.push("Čerstvě přidáno") }

  return {
    id: r.id,
    aiScore: Math.min(100, Math.max(0, score)),
    aiTags: tags,
    aiDoporuceni: tags.length > 0
      ? `Nabídka splňuje kritéria: ${tags.join(", ")}.`
      : "Standardní nabídka bez výrazných odchylek od průměru trhu.",
  }
}

// ── POST /api/monitoring-live/analyze ─────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { results } = (await req.json()) as { results: MonitoringResult[] }

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json({ scores: [] })
    }

    const liveResults = results.filter((r) => !r.jeFallback)
    if (liveResults.length === 0) {
      return NextResponse.json({ scores: [] })
    }

    // Check cache
    const cacheKey = getCacheKey(liveResults)
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      return NextResponse.json({ scores: cached.scores, fromCache: true })
    }

    // Call Claude
    const prompt = `Ohodnoť tyto nemovitosti z hlediska investičního potenciálu, poměru cena/kvalita a zajímavosti pro klienty realitní kanceláře v Praze. Ignoruj nemovitosti s nerealisticky nízkou cenou (pod 500 000 Kč) — tyto mají cenu "na vyžádání" a nelze je hodnotit; pokud taková projde, dej jí score 0. Pro každou nemovitost vrať:
- id (string, stejné jako vstup)
- aiScore (0-100, kde 100 = extrémně zajímavá)
- aiTags (array stringů: např. 'Pod tržní cenou', 'Výborná lokalita', 'Investiční příležitost', 'Ideální pro rodiny', 'Novostavba', 'K rekonstrukci — nižší cena', 'Velká plocha', 'Prémiová adresa')
- aiDoporuceni (1-2 věty česky proč je/není zajímavá)

Nemovitosti:
${JSON.stringify(
  liveResults.map((r) => ({
    id: r.id,
    nazev: r.nazev,
    cena: r.cena,
    lokalita: r.lokalita,
    plocha: r.plocha,
    dispozice: r.dispozice,
  })),
  null,
  2,
)}

ODPOVĚZ POUZE JSON ARRAYEM, žádný další text.`

    let scores: AiScore[]

    try {
      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        system:
          "Jsi expert na český realitní trh. Analyzuj nabídky nemovitostí a ohodnoť jejich zajímavost pro realitní kancelář. Odpovídej POUZE validním JSON arrayem.",
        prompt,
        maxOutputTokens: 2000,
      })

      // Strip markdown code fences if present
      const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()
      const parsed = JSON.parse(cleaned) as AiScore[]

      // Validate and fill missing
      scores = liveResults.map((r) => {
        const ai = parsed.find((p) => p.id === r.id)
        if (!ai) return ruleBasedScore(r)
        return {
          id: r.id,
          aiScore: typeof ai.aiScore === "number" ? Math.min(100, Math.max(0, ai.aiScore)) : 50,
          aiTags: Array.isArray(ai.aiTags) ? ai.aiTags.slice(0, 4) : [],
          aiDoporuceni: typeof ai.aiDoporuceni === "string" ? ai.aiDoporuceni : "",
        }
      })
    } catch {
      // Fallback on Claude failure
      scores = liveResults.map(ruleBasedScore)
    }

    // Store in cache
    cache.set(cacheKey, { scores, ts: Date.now() })

    return NextResponse.json({ scores })
  } catch (err) {
    return NextResponse.json({ error: String(err), scores: [] }, { status: 500 })
  }
}
