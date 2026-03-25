import { NextResponse, NextRequest } from "next/server"
import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"

export const maxDuration = 60

interface CacheEntry { data: NewsItem[]; ts: number }
const cache = new Map<string, CacheEntry>()
const CACHE_TTL = 2 * 60 * 60 * 1000

interface NewsItem {
  titulek: string
  zdroj: string
  datum: string
  shrnutí: string
  url: string
  sentiment: "pozitivni" | "negativni" | "neutralni"
}

export async function GET(req: NextRequest) {
  const lokalita = req.nextUrl.searchParams.get("lokalita") ?? "Česko"
  const tema = req.nextUrl.searchParams.get("tema") ?? ""
  const cacheKey = `${lokalita}-${tema}`.toLowerCase()

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ news: cached.data, fromCache: true })
  }

  try {
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: "Jsi novinář specializující se na český realitní trh. Na základě svých znalostí vytvoř přehled aktuálního dění. Odpovídej POUZE validním JSON arrayem.",
      prompt: `Vytvoř přehled 6-8 nejdůležitějších zpráv a trendů z realitního trhu v ${lokalita}${tema ? ` se zaměřením na ${tema}` : ""}. Zaměř se na: vývoj cen nemovitostí, hypoteční sazby, nové projekty, legislativu, trendy v bydlení.

Aktuální datum: ${new Date().toLocaleDateString("cs-CZ")}

Vrať JSON array:
[{
  "titulek": "titulek zprávy",
  "zdroj": "zdroj nebo 'Analýza trhu'",
  "datum": "datum ve formátu YYYY-MM-DD (v posledním měsíci)",
  "shrnutí": "2-3 věty česky",
  "url": "#",
  "sentiment": "pozitivni"|"negativni"|"neutralni"
}]

ODPOVĚZ POUZE JSON ARRAYEM.`,
      maxOutputTokens: 2000,
    })

    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()
    const news: NewsItem[] = JSON.parse(cleaned)

    cache.set(cacheKey, { data: news, ts: Date.now() })
    return NextResponse.json({ news, lokalita })
  } catch (err) {
    return NextResponse.json({ news: [], error: String(err) }, { status: 500 })
  }
}
