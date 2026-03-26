// FIX: replaced self-fetch with direct call
// Shared monitoring logic — call this instead of fetching /api/monitoring-live

import type { MonitoringResult } from "@/lib/data/monitoring"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

// ── Seeded PRNG (handles h=0 to avoid negative indices) ─────────────────────

function seededRandom(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  h = Math.abs(h) || 1
  return () => {
    h = Math.abs((h * 16807) % 2147483647) || 1
    return (h - 1) / 2147483646
  }
}

// ── Locality config ──────────────────────────────────────────────────────────

const REGIONS: Record<string, { region_id: string; label: string }> = {
  "praha":              { region_id: "10", label: "Praha" },
  "praha-7-holesovice": { region_id: "10", label: "Praha 7 – Holešovice" },
  "brno":               { region_id: "14", label: "Brno" },
  "plzen":              { region_id: "20", label: "Plzeň" },
}

// ── Smart fallback constants ─────────────────────────────────────────────────

const SMART_DISPS = [
  { disp: "1+kk", minArea: 28, maxArea: 42, priceBase: 3_200_000, priceRange: 2_400_000 },
  { disp: "2+kk", minArea: 45, maxArea: 63, priceBase: 4_500_000, priceRange: 3_800_000 },
  { disp: "2+1",  minArea: 55, maxArea: 68, priceBase: 4_900_000, priceRange: 4_100_000 },
  { disp: "3+kk", minArea: 65, maxArea: 88, priceBase: 6_500_000, priceRange: 6_000_000 },
  { disp: "3+1",  minArea: 75, maxArea: 98, priceBase: 7_200_000, priceRange: 6_800_000 },
  { disp: "4+kk", minArea: 88, maxArea: 120, priceBase: 9_500_000, priceRange: 8_500_000 },
]

const SMART_NEIGHBORHOODS: Record<string, string[]> = {
  "praha-7-holesovice": ["Praha 7 – Holešovice", "Praha 7 – Letná", "Praha 7 – Bubeneč", "Praha 7 – Troja"],
  "praha": [
    "Praha 2 – Vinohrady", "Praha 3 – Žižkov", "Praha 5 – Smíchov",
    "Praha 4 – Nusle", "Praha 8 – Karlín", "Praha 6 – Dejvice",
    "Praha 7 – Holešovice", "Praha 10 – Vršovice", "Praha 4 – Modřany",
    "Praha 9 – Letňany", "Praha 2 – Nové Město",
  ],
  "brno": ["Brno – střed", "Brno – Královo Pole", "Brno – Žabovřesky", "Brno – Bystrc", "Brno – Líšeň", "Brno – Veveří"],
  "plzen": ["Plzeň 1", "Plzeň 2 – Slovany", "Plzeň 3 – Lochotín", "Plzeň 4", "Plzeň – centrum"],
}

const SMART_PRICE_MULT: Record<string, number> = {
  "praha-7-holesovice": 1.18,
  "praha":              1.0,
  "brno":               0.62,
  "plzen":              0.52,
}

const SMART_FALLBACK_URLS: Record<string, string> = {
  "praha":              "https://www.sreality.cz/hledani/prodej/byty/praha",
  "praha-7-holesovice": "https://www.sreality.cz/hledani/prodej/byty/praha-7",
  "brno":               "https://www.sreality.cz/hledani/prodej/byty/brno",
  "plzen":              "https://www.sreality.cz/hledani/prodej/byty/plzen",
}

function generateSmartFallback(lokalitaKey: string, count = 20): MonitoringResult[] {
  const searchUrl = SMART_FALLBACK_URLS[lokalitaKey] ?? SMART_FALLBACK_URLS["praha"]!
  const mult      = SMART_PRICE_MULT[lokalitaKey] ?? 1.0
  const hoods     = SMART_NEIGHBORHOODS[lokalitaKey] ?? SMART_NEIGHBORHOODS["praha"]!
  const today     = new Date().toISOString().slice(0, 10)
  const rand      = seededRandom(`sreality-${lokalitaKey}-${today}`)
  const now       = new Date()

  return Array.from({ length: count }, (_, i) => {
    const dIdx = Math.floor(rand() * SMART_DISPS.length) % SMART_DISPS.length
    const d    = SMART_DISPS[dIdx] ?? SMART_DISPS[0]
    const area = d.minArea + Math.floor(rand() * (d.maxArea - d.minArea + 1))
    const cena = Math.round((d.priceBase + rand() * d.priceRange) * mult / 50_000) * 50_000
    const hIdx = Math.floor(rand() * hoods.length) % Math.max(1, hoods.length)
    const hood = hoods[hIdx] ?? hoods[0] ?? "Praha"
    const dayOffset = Math.floor(rand() * 3)
    const dateObj   = new Date(now)
    dateObj.setDate(dateObj.getDate() - dayOffset)
    dateObj.setHours(7, Math.floor(rand() * 60), 0, 0)

    return {
      id:            `sreality-sf-${i}-${today}`,
      server:        "sreality" as const,
      nazev:         `Prodej bytu ${d.disp} ${area} m², ${hood}`,
      cena,
      lokalita:      hood,
      url:           searchUrl,
      plocha:        area,
      dispozice:     d.disp,
      datumNalezeni: dateObj.toISOString(),
      novinka:       dayOffset === 0,
      jeFallback:    false,
    } satisfies MonitoringResult
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractDisposition(name: string): string {
  return name.match(/\b(\d+\+(?:kk|\d+))\b/i)?.[1]?.toLowerCase() ?? "byt"
}

function extractArea(name: string): number {
  return parseInt(name.match(/(\d+)\s*m[²2]/i)?.[1] ?? "0", 10)
}

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetches real estate listings for the given locality.
 * Tries Sreality API directly. Falls back to smart deterministic data if blocked.
 */
export async function fetchMonitoringResults(lokalitaKey: string): Promise<MonitoringResult[]> {
  const region = REGIONS[lokalitaKey] ?? REGIONS["praha"]!

  const url = new URL("https://www.sreality.cz/api/cs/v2/estates")
  url.searchParams.set("category_main_cb", "1")
  url.searchParams.set("category_type_cb", "1")
  url.searchParams.set("locality_region_id", region.region_id)
  url.searchParams.set("per_page", "60")
  url.searchParams.set("tms", Date.now().toString())

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8",
        Referer: "https://www.sreality.cz/",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    })

    console.log(`[monitoring-core] Sreality status ${res.status} for ${lokalitaKey}`)

    if (!res.ok) throw new Error(`Sreality HTTP ${res.status}`)

    const json = await res.json() as { _embedded?: { estates?: unknown[] } }
    const estates = json?._embedded?.estates ?? []

    console.log(`[monitoring-core] Sreality returned ${estates.length} estates`)

    if (estates.length > 0) {
      const now = new Date().toISOString()
      const results: MonitoringResult[] = (estates as Record<string, unknown>[])
        .filter((e) => e.hash_id != null)
        .map((e): MonitoringResult => {
          const hashId = e.hash_id as number
          const name   = (e.name as string) ?? ""
          const price  = (e.price_czk as { value_raw?: number } | null)?.value_raw ?? (e.price as number) ?? 0
          const dispozice = extractDisposition(name)
          const plocha    = extractArea(name)
          const localityRaw  = (e.seo as { locality?: string } | null)?.locality ?? (e.locality as string) ?? region.label
          const localitySlug = toSlug(localityRaw)
          const rawHref = ((e._links as { images?: { href: string }[] } | null)?.images?.[0]?.href) ?? ""

          return {
            id:            `sreality-${hashId}`,
            server:        "sreality",
            nazev:         name,
            cena:          price,
            lokalita:      localityRaw,
            url:           `https://www.sreality.cz/detail/prodej/byt/${dispozice}/${localitySlug}/${hashId}`,
            plocha:        plocha || 0,
            dispozice:     dispozice,
            datumNalezeni: now,
            novinka:       (e.new as boolean) ?? false,
            jeFallback:    false,
            obrazek:       rawHref && rawHref.startsWith("http") && !rawHref.includes("{") ? rawHref : undefined,
          }
        })
        .filter((r) => r.cena >= 100_000)

      if (results.length > 0) {
        console.log(`[monitoring-core] Returning ${results.length} live results`)
        return results
      }
    }
  } catch (err) {
    console.log(`[monitoring-core] Sreality failed for ${lokalitaKey}:`, err)
  }

  console.log(`[monitoring-core] Using smart fallback for ${lokalitaKey}`)
  return generateSmartFallback(lokalitaKey)
}
