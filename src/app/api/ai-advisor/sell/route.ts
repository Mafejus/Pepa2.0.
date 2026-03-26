import { NextResponse } from "next/server"
import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { prisma } from "@/lib/db"

export const maxDuration = 60

interface CachedResult { data: SellRecommendation[]; ts: number }
const cache = new Map<string, CachedResult>()
const CACHE_TTL = 2 * 60 * 60 * 1000

interface SellRecommendation {
  propertyId: string
  nazev: string
  aktualniCena: number
  odhadTrzniCena: number
  doporuceni: "prodat" | "drzet" | "snizit_cenu"
  duvod: string
  urgence: "vysoká" | "střední" | "nízká"
}

export async function GET() {
  const cached = cache.get("sell")
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ recommendations: cached.data, fromCache: true })
  }

  try {
    const properties = await prisma.property.findMany({
      where: { stav: { in: ["aktivni", "rezervovano"] } },
      select: { id: true, nazev: true, typ: true, lokalita: true, cena: true, plocha: true, dispozice: true, stav: true },
      take: 20,
    })

    if (properties.length === 0) {
      return NextResponse.json({ recommendations: [] })
    }

    let recommendations: SellRecommendation[]
    try {
      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        system: "Jsi expert na český realitní trh. Odpovídej POUZE validním JSON arrayem.",
        prompt: `Analyzuj portfolio těchto nemovitostí a doporuč prodejní strategii. Porovnej ceny s aktuálním trhem v Praze.

Portfolio:
${JSON.stringify(properties, null, 2)}

Pro každou nemovitost doporuč:
- "prodat" = trh je příznivý, cena je pod tržní hodnotou nebo na ní
- "drzet" = cena je podhodnocena, vhodné počkat
- "snizit_cenu" = cena je nad tržní hodnotou, snížení urychlí prodej

Odpověz v JSON: [{ "propertyId": string, "nazev": string, "aktualniCena": number, "odhadTrzniCena": number, "doporuceni": "prodat"|"drzet"|"snizit_cenu", "duvod": "vysvětlení 2-3 věty", "urgence": "vysoká"|"střední"|"nízká" }]

ODPOVĚZ POUZE JSON ARRAYEM.`,
        maxOutputTokens: 4096,
      })

      const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()
      try {
        recommendations = JSON.parse(cleaned) as SellRecommendation[]
      } catch {
        const jsonStart = cleaned.indexOf("[")
        const jsonEnd   = cleaned.lastIndexOf("]")
        if (jsonStart !== -1 && jsonEnd > jsonStart) {
          try {
            recommendations = JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as SellRecommendation[]
          } catch (parseErr: unknown) {
            const msg = parseErr instanceof Error ? parseErr.message : String(parseErr)
            console.error("[ai-advisor/sell] JSON parse failed:", msg)
            console.error("[ai-advisor/sell] Raw text (first 500):", text.substring(0, 500))
            throw new Error("JSON parse failed: " + msg)
          }
        } else {
          console.error("[ai-advisor/sell] No JSON array found in response")
          console.error("[ai-advisor/sell] Raw text (first 500):", text.substring(0, 500))
          throw new Error("No JSON array in Claude response")
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error("[ai-advisor/sell] Claude API error:", msg)
      return NextResponse.json(
        { recommendations: [], error: "AI analýza dočasně nedostupná. Zkuste to za chvíli.", detail: msg },
        { status: 503 }
      )
    }

    cache.set("sell", { data: recommendations, ts: Date.now() })
    return NextResponse.json({ recommendations })
  } catch (err) {
    console.error("[ai-advisor/sell] error:", err)
    return NextResponse.json({ recommendations: [], error: "Chyba serveru. Zkuste to za chvíli." }, { status: 500 })
  }
}
