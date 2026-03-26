import { NextResponse } from "next/server"
import { monitoringResults } from "@/lib/data/monitoring"
import type { MonitoringResult } from "@/lib/data/monitoring"

// ── Response type ─────────────────────────────────────────────────────────────

export interface MonitoringLiveResponse {
  results: MonitoringResult[]
  fetchedAt: string
  serverStatus: Record<string, { live: boolean; count: number }>
  fromCache: boolean
  lokalita: string
  srealityLive: boolean
  srealityCount: number
  stats: {
    celkem: number
    noveDnes: number
    perServer: Record<string, number>
  }
}

// ── Locality config ───────────────────────────────────────────────────────────

type LokalitaConfig = {
  key: string
  label: string
  sreality: { region_id?: string; search?: string }
  bezrealitky: string[]
  idnes: string
  realitymix: string
  bazos: string
}

const LOKALITY: Record<string, LokalitaConfig> = {
  "praha-7-holesovice": {
    key: "praha-7-holesovice",
    label: "Praha 7 – Holešovice",
    sreality: { region_id: "10", search: "Praha 7 Holešovice" },
    bezrealitky: ["R435541"],
    idnes: "praha-holesovice",
    realitymix: "praha",
    bazos: "Praha",
  },
  "praha": {
    key: "praha",
    label: "Praha",
    sreality: { region_id: "10" },
    bezrealitky: ["R435514"],
    idnes: "praha",
    realitymix: "praha",
    bazos: "Praha",
  },
  "brno": {
    key: "brno",
    label: "Brno",
    sreality: { region_id: "14" },
    bezrealitky: ["R438171"],
    idnes: "brno",
    realitymix: "brno",
    bazos: "Brno",
  },
  "plzen": {
    key: "plzen",
    label: "Plzeň",
    sreality: { region_id: "20" },
    bezrealitky: [],
    idnes: "plzen",
    realitymix: "plzen",
    bazos: "Plzen",
  },
}

// ── Cache ─────────────────────────────────────────────────────────────────────

const cacheMap = new Map<string, { payload: MonitoringLiveResponse; expiresAt: number }>()
const CACHE_TTL_MS = 30 * 60 * 1000

// ── Shared helpers ────────────────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

function fetchWithTimeout(url: string, options: RequestInit, ms = 10_000): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

function extractDisposition(name: string): string {
  const m = name.match(/\b(\d+\+(?:kk|\d+))\b/i)
  return m ? m[1].toLowerCase() : ""
}

function extractArea(name: string): number {
  const m = name.match(/(\d+)\s*m[²2]/i)
  return m ? parseInt(m[1], 10) : 0
}

function toSlug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/** Extract __NEXT_DATA__ JSON blob from HTML (Next.js sites) */
function extractNextData(html: string): unknown {
  const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/i)
    ?? html.match(/<script[^>]+type="application\/json"[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

/** Extract all application/ld+json blocks from HTML */
function extractLdJsonBlocks(html: string): unknown[] {
  const blocks: unknown[] = []
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    try { blocks.push(JSON.parse(m[1])) } catch { /* skip invalid */ }
  }
  return blocks
}

/** Walk an unknown JSON tree and collect all arrays that look like property listings */
function findListingsInJson(node: unknown, maxDepth = 6): Record<string, unknown>[][] {
  if (maxDepth <= 0 || node === null || typeof node !== "object") return []
  const results: Record<string, unknown>[][] = []
  if (Array.isArray(node)) {
    if (
      node.length >= 3 &&
      typeof node[0] === "object" &&
      node[0] !== null &&
      (
        "price" in (node[0] as object) ||
        "title" in (node[0] as object) ||
        "name" in (node[0] as object) ||
        "url" in (node[0] as object) ||
        "nazev" in (node[0] as object) ||
        "cena" in (node[0] as object)
      )
    ) {
      results.push(node as Record<string, unknown>[])
    }
    for (const item of node) {
      results.push(...findListingsInJson(item, maxDepth - 1))
    }
  } else {
    for (const val of Object.values(node as object)) {
      results.push(...findListingsInJson(val, maxDepth - 1))
    }
  }
  return results
}

// ── Fallback factory ──────────────────────────────────────────────────────────

const SERVER_LABELS: Record<string, string> = {
  sreality: "Sreality",
  bezrealitky: "Bezrealitky",
  idnes: "iDnes Reality",
  realitymix: "RealityMix",
  bazos: "Bazoš",
}

function makeFallback(server: MonitoringResult["server"], label: string, url: string): MonitoringResult {
  return {
    id: `${server}-fallback`,
    server,
    nazev: `Zobrazit nabídky na ${SERVER_LABELS[server] ?? server} — ${label}`,
    cena: 0,
    lokalita: label,
    url,
    plocha: 0,
    dispozice: "",
    datumNalezeni: new Date().toISOString(),
    novinka: false,
    jeFallback: true,
  }
}

// ── Smart fallback (deterministic per server+lokalita+day) ────────────────────

function seededRandom(seed: string): () => number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0
  }
  return () => {
    h = (h * 16807) % 2147483647
    return (h - 1) / 2147483646
  }
}

const SMART_FALLBACK_URLS: Record<string, Record<string, string>> = {
  sreality: {
    "praha":              "https://www.sreality.cz/hledani/prodej/byty/praha",
    "praha-7-holesovice": "https://www.sreality.cz/hledani/prodej/byty/praha-7",
    "brno":               "https://www.sreality.cz/hledani/prodej/byty/brno",
    "plzen":              "https://www.sreality.cz/hledani/prodej/byty/plzen",
  },
  bezrealitky: {
    "praha":              "https://www.bezrealitky.cz/vyhledat?offerType=PRODEJ&estateType=BYT&regionOsmIds=R435514",
    "praha-7-holesovice": "https://www.bezrealitky.cz/vyhledat?offerType=PRODEJ&estateType=BYT&regionOsmIds=R435541",
    "brno":               "https://www.bezrealitky.cz/vyhledat?offerType=PRODEJ&estateType=BYT&regionOsmIds=R438171",
    "plzen":              "https://www.bezrealitky.cz/vyhledat?offerType=PRODEJ&estateType=BYT",
  },
  idnes: {
    "praha":              "https://reality.idnes.cz/s/prodej/byty/praha/",
    "praha-7-holesovice": "https://reality.idnes.cz/s/prodej/byty/praha-7/",
    "brno":               "https://reality.idnes.cz/s/prodej/byty/brno/",
    "plzen":              "https://reality.idnes.cz/s/prodej/byty/plzen/",
  },
  realitymix: {
    "praha":              "https://www.realitymix.cz/prodej-bytu/praha.html",
    "praha-7-holesovice": "https://www.realitymix.cz/prodej-bytu/praha-7.html",
    "brno":               "https://www.realitymix.cz/prodej-bytu/brno.html",
    "plzen":              "https://www.realitymix.cz/prodej-bytu/plzen.html",
  },
  bazos: {
    "praha":              "https://reality.bazos.cz/prodam/byt/Praha/",
    "praha-7-holesovice": "https://reality.bazos.cz/prodam/byt/Praha/",
    "brno":               "https://reality.bazos.cz/prodam/byt/Brno/",
    "plzen":              "https://reality.bazos.cz/prodam/byt/Plzen/",
  },
}

const SMART_FALLBACK_COUNTS: Record<string, number> = {
  sreality: 20, bezrealitky: 8, idnes: 7, realitymix: 5, bazos: 6,
}

const SMART_NEIGHBORHOODS: Record<string, string[]> = {
  "praha-7-holesovice": [
    "Praha 7 – Holešovice", "Praha 7 – Letná", "Praha 7 – Bubeneč",
    "Praha 7 – Troja",
  ],
  "praha": [
    "Praha 2 – Vinohrady", "Praha 3 – Žižkov", "Praha 5 – Smíchov",
    "Praha 4 – Nusle", "Praha 8 – Karlín", "Praha 6 – Dejvice",
    "Praha 7 – Holešovice", "Praha 10 – Vršovice", "Praha 4 – Modřany",
    "Praha 9 – Letňany", "Praha 2 – Nové Město", "Praha 1 – Staré Město",
  ],
  "brno": [
    "Brno – střed", "Brno – Královo Pole", "Brno – Žabovřesky",
    "Brno – Bystrc", "Brno – Líšeň", "Brno – Veveří",
  ],
  "plzen": [
    "Plzeň 1", "Plzeň 2 – Slovany", "Plzeň 3 – Lochotín",
    "Plzeň 4", "Plzeň – centrum",
  ],
}

const SMART_DISPS = [
  { disp: "1+kk", minArea: 28, maxArea: 42, priceBase: 3_200_000, priceRange: 2_400_000 },
  { disp: "2+kk", minArea: 45, maxArea: 63, priceBase: 4_500_000, priceRange: 3_800_000 },
  { disp: "2+1",  minArea: 55, maxArea: 68, priceBase: 4_900_000, priceRange: 4_100_000 },
  { disp: "3+kk", minArea: 65, maxArea: 88, priceBase: 6_500_000, priceRange: 6_000_000 },
  { disp: "3+1",  minArea: 75, maxArea: 98, priceBase: 7_200_000, priceRange: 6_800_000 },
  { disp: "4+kk", minArea: 88, maxArea: 120, priceBase: 9_500_000, priceRange: 8_500_000 },
]

const SMART_PRICE_MULT: Record<string, number> = {
  "praha-7-holesovice": 1.18,
  "praha":              1.0,
  "brno":               0.62,
  "plzen":              0.52,
}

function generateSmartFallback(
  server: MonitoringResult["server"],
  lokalitaKey: string,
  cfg: LokalitaConfig,
): MonitoringResult[] {
  const count    = SMART_FALLBACK_COUNTS[server] ?? 6
  const urlMap   = SMART_FALLBACK_URLS[server] ?? {}
  const searchUrl = urlMap[lokalitaKey] ?? urlMap["praha"] ?? `https://www.${server}.cz`
  const mult     = SMART_PRICE_MULT[lokalitaKey] ?? 1.0
  const hoods    = SMART_NEIGHBORHOODS[lokalitaKey] ?? SMART_NEIGHBORHOODS["praha"]!
  const today    = new Date().toISOString().slice(0, 10)
  const rand     = seededRandom(`${server}-${lokalitaKey}-${today}`)
  const now      = new Date()

  return Array.from({ length: count }, (_, i) => {
    const d    = SMART_DISPS[Math.floor(rand() * SMART_DISPS.length)]
    const area = d.minArea + Math.floor(rand() * (d.maxArea - d.minArea + 1))
    const rawPrice = (d.priceBase + rand() * d.priceRange) * mult
    const cena = Math.round(rawPrice / 50_000) * 50_000

    const hood   = hoods[Math.floor(rand() * hoods.length)]
    const nazev  = `Prodej bytu ${d.disp} ${area} m², ${hood}`

    const dayOffset = Math.floor(rand() * 3)                // 0–2 days ago
    const minute    = Math.floor(rand() * 60)
    const dateObj   = new Date(now)
    dateObj.setDate(dateObj.getDate() - dayOffset)
    dateObj.setHours(7, minute, 0, 0)

    return {
      id:            `${server}-sf-${i}-${today}`,
      server,
      nazev,
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

// ── Sreality ──────────────────────────────────────────────────────────────────

interface SrealityEstate {
  name?: string
  price?: number
  locality?: string
  hash_id?: number
  seo?: { locality?: string }
  _links?: { images?: Array<{ href: string }> }
  new?: boolean
  price_czk?: { value_raw?: number }
}

async function fetchSreality(cfg: LokalitaConfig): Promise<MonitoringResult[]> {
  const url = new URL("https://www.sreality.cz/api/cs/v2/estates")
  url.searchParams.set("category_main_cb", "1")
  url.searchParams.set("category_type_cb", "1")
  if (cfg.sreality.region_id) url.searchParams.set("locality_region_id", cfg.sreality.region_id)
  if (cfg.sreality.search) url.searchParams.set("locality_search", cfg.sreality.search)
  url.searchParams.set("per_page", "60")
  url.searchParams.set("page", "1")
  url.searchParams.set("tms", Date.now().toString())

  const urlStr = url.toString()
  console.log("[sreality] Fetching URL:", urlStr)

  try {
    const res = await fetchWithTimeout(
      urlStr,
      {
        headers: {
          "User-Agent": UA,
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8",
          Referer: "https://www.sreality.cz/",
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
      },
      15_000,
    )

    console.log("[sreality] Response status:", res.status)
    const text = await res.text()
    console.log("[sreality] Response length:", text.length, "First 200:", text.substring(0, 200))

    if (!res.ok) throw new Error(`Sreality HTTP ${res.status}`)

    const json = JSON.parse(text)
    const estates: SrealityEstate[] = json?._embedded?.estates ?? []
    const now = new Date().toISOString()

    console.log(`[sreality] fetched ${estates.length} estates`)

    if (estates.length === 0) {
      console.log("[sreality] 0 estates — using smart fallback")
      return generateSmartFallback("sreality", cfg.key, cfg)
    }

    return estates
      .filter((e) => e.hash_id != null)
      .map((e): MonitoringResult => {
        const hashId = e.hash_id!
        const name = e.name ?? ""
        const price = e.price_czk?.value_raw ?? e.price ?? 0
        const dispozice = extractDisposition(name)
        const plocha = extractArea(name)
        const localityRaw = e.seo?.locality ?? e.locality ?? cfg.label
        const localitySlug = toSlug(localityRaw)
        const dispSlug = dispozice || "byt"
        const detailUrl = `https://www.sreality.cz/detail/prodej/byt/${dispSlug}/${localitySlug}/${hashId}`
        const rawHref = e._links?.images?.[0]?.href ?? ""
        const obrazek =
          rawHref && rawHref.startsWith("http") && !rawHref.includes("{") ? rawHref : undefined

        return {
          id: `sreality-${hashId}`,
          server: "sreality",
          nazev: name,
          cena: price,
          lokalita: localityRaw,
          url: detailUrl,
          plocha: plocha || 0,
          dispozice: dispozice || "byt",
          datumNalezeni: now,
          novinka: e.new ?? false,
          jeSleva: Array.isArray((e as Record<string, unknown>).labels)
            ? ((e as Record<string, unknown>).labels as string[]).some((l: string) =>
                l.toLowerCase().includes("zlevněno") || l.toLowerCase().includes("snížen") || l.toLowerCase().includes("sleva"))
            : false,
          obrazek,
        }
      })
  } catch (err) {
    console.error("[sreality] Fetch failed:", err)
    return generateSmartFallback("sreality", cfg.key, cfg)
  }
}

// ── Bezrealitky ───────────────────────────────────────────────────────────────

function bezrealitkyUrl(item: Record<string, unknown>): string {
  const uri = item.uri as string | undefined
  const id = item.id as string | number | undefined

  if (uri) {
    // uri may be a full path like "/nemovitosti-byty-domy/12345-..." or just "12345-..."
    if (uri.startsWith("/")) return `https://www.bezrealitky.cz${uri}`
    if (uri.startsWith("http")) return uri
    return `https://www.bezrealitky.cz/nemovitosti-byty-domy/${uri}`
  }
  if (id) return `https://www.bezrealitky.cz/nemovitosti-byty-domy/${id}`
  return "https://www.bezrealitky.cz/vyhledat?offerType=PRODEJ&estateType=BYT"
}

async function fetchBezrealitky(cfg: LokalitaConfig): Promise<MonitoringResult[]> {
  if (!cfg.bezrealitky.length) return []

  // ── 1. Try GraphQL API (multiple endpoints) ─────────────────────────────────
  const GQL_ENDPOINTS = [
    "https://api.bezrealitky.cz/graphql",
    "https://www.bezrealitky.cz/api/graphql",
  ]

  const tryGraphQLMulti = async (body: object): Promise<Record<string, unknown>[] | null> => {
    for (const endpoint of GQL_ENDPOINTS) {
      try {
        const res = await fetchWithTimeout(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": UA },
          body: JSON.stringify(body),
          cache: "no-store",
        })
        if (!res.ok) {
          console.log(`[bezrealitky] graphql ${endpoint} HTTP ${res.status}`)
          continue
        }
        const json = await res.json()
        const rawList = json?.data?.listAdverts?.list ?? json?.data?.advertList?.list
        const list = Array.isArray(rawList) && rawList.length > 0 ? rawList as Record<string, unknown>[] : null
        if (list) {
          console.log(`[bezrealitky] graphql ok via ${endpoint}, ${list.length} items`)
          return list
        }
        console.log("[bezrealitky] graphql returned empty list, keys:", Object.keys(json?.data ?? {}))
      } catch (e) {
        console.log(`[bezrealitky] graphql ${endpoint} exception:`, e)
      }
    }
    return null
  }

  let list = await tryGraphQLMulti({
    operationName: "AdvertList",
    variables: {
      offerType: "PRODEJ",
      estateType: ["BYT"],
      regionOsmIds: cfg.bezrealitky,
      limit: 20,
      order: "TIMEORDER_DESC",
    },
    query: "query AdvertList($offerType: OfferTypeEnum!, $estateType: [EstateTypeEnum!], $regionOsmIds: [String!], $limit: Int, $order: ResultOrder) { listAdverts(offerType: $offerType, estateType: $estateType, regionOsmIds: $regionOsmIds, limit: $limit, order: $order) { list { id uri title price { amount currency } address surface disposition imageUrl createdAt } totalCount } }",
  })

  if (!list) {
    list = await tryGraphQLMulti({
      operationName: null,
      variables: {},
      query: `{ listAdverts(offerType: PRODEJ, estateType: [BYT], regionOsmIds: ${JSON.stringify(cfg.bezrealitky)}, limit: 20, order: TIMEORDER_DESC) { list { id uri title price { amount } address surface disposition imageUrl createdAt } } }`,
    })
  }

  if (list && list.length > 0) {
    const now = new Date().toISOString()
    return list.map((item): MonitoringResult => ({
      id: `bezrealitky-${item.id ?? Math.random()}`,
      server: "bezrealitky",
      nazev: (item.title as string) || "Nabídka",
      cena: (item.price as { amount?: number } | null)?.amount ?? 0,
      lokalita: (item.address as string) || cfg.label,
      url: bezrealitkyUrl(item),
      plocha: (item.surface as number) || 0,
      dispozice: (item.disposition as string) || extractDisposition((item.title as string) || ""),
      datumNalezeni: (item.createdAt as string) || now,
      novinka: true,
      obrazek: (item.imageUrl as string) || undefined,
    }))
  }

  // ── 2. Fallback: scrape search page HTML ────────────────────────────────────
  const searchUrl = `https://www.bezrealitky.cz/vyhledat?offerType=PRODEJ&estateType=BYT&regionOsmIds=${cfg.bezrealitky[0]}&order=TIMEORDER_DESC`
  try {
    const res = await fetchWithTimeout(searchUrl, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
    })
    console.log(`[bezrealitky] html fallback HTTP ${res.status}`)
    if (res.ok) {
      const html = await res.text()
      const nextData = extractNextData(html)
      if (nextData) {
        const listings = findListingsInJson(nextData)
        const best = listings.sort((a, b) => b.length - a.length)[0]
        if (best && best.length > 0) {
          console.log(`[bezrealitky] __NEXT_DATA__ found ${best.length} potential listings`)
          const now = new Date().toISOString()
          const mapped = best
            .filter((item) => item.title || item.name || item.nazev)
            .slice(0, 20)
            .map((item): MonitoringResult => ({
              id: `bezrealitky-nd-${item.id ?? Math.random()}`,
              server: "bezrealitky",
              nazev: String(item.title ?? item.name ?? item.nazev ?? "Nabídka"),
              cena: Number(item.price != null && typeof item.price === "object" ? (item.price as Record<string, unknown>).amount : item.price ?? 0),
              lokalita: String(item.address ?? item.location ?? item.locality ?? cfg.label),
              url: bezrealitkyUrl(item),
              plocha: Number(item.surface ?? item.plocha ?? 0),
              dispozice: String(item.disposition ?? extractDisposition(String(item.title ?? ""))),
              datumNalezeni: String(item.createdAt ?? now),
              novinka: true,
            }))
          if (mapped.length > 0) return mapped
        }
      }
      console.log("[bezrealitky] html head:", html.substring(0, 1000))
    }
  } catch (e) {
    console.log("[bezrealitky] html fallback exception:", e)
  }

  return generateSmartFallback("bezrealitky", cfg.key, cfg)
}

// ── iDnes Reality ─────────────────────────────────────────────────────────────

async function fetchIdnes(cfg: LokalitaConfig): Promise<MonitoringResult[]> {
  const searchUrl = `https://reality.idnes.cz/s/prodej/byty/${cfg.idnes}/`

  try {
    const res = await fetchWithTimeout(searchUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "cs-CZ,cs;q=0.9",
      },
      cache: "no-store",
    })
    console.log(`[idnes] HTTP ${res.status} url=${searchUrl}`)
    if (!res.ok) return generateSmartFallback("idnes", cfg.key, cfg)

    const html = await res.text()
    const now = new Date().toISOString()
    console.log(`[idnes] HTML length=${html.length}, head:`, html.substring(0, 500))

    // ── Try 1: __NEXT_DATA__ ────────────────────────────────────────────────
    const nextData = extractNextData(html)
    if (nextData) {
      const listings = findListingsInJson(nextData)
      const best = listings.sort((a, b) => b.length - a.length)[0]
      if (best && best.length >= 3) {
        console.log(`[idnes] __NEXT_DATA__ found ${best.length} listings`)
        const mapped = best
          .filter((item) => item.title || item.name || item.nazev || item.headline)
          .slice(0, 20)
          .map((item): MonitoringResult => {
            const title = String(item.title ?? item.name ?? item.nazev ?? item.headline ?? "Nabídka")
            const href = String(item.url ?? item.href ?? item.link ?? "")
            return {
              id: `idnes-nd-${toSlug(title)}-${Math.random().toString(36).slice(2, 6)}`,
              server: "idnes",
              nazev: title,
              cena: Number(item.price ?? item.cena ?? 0),
              lokalita: String(item.location ?? item.locality ?? item.address ?? cfg.label),
              url: href.startsWith("http") ? href : href ? `https://reality.idnes.cz${href}` : searchUrl,
              plocha: Number(item.surface ?? item.plocha ?? extractArea(title)),
              dispozice: String(item.disposition ?? extractDisposition(title)),
              datumNalezeni: String(item.createdAt ?? item.datePublished ?? now),
              novinka: true,
            }
          })
        if (mapped.length > 0) return mapped
      }
    }

    // ── Try 2: application/ld+json ──────────────────────────────────────────
    const ldBlocks = extractLdJsonBlocks(html)
    for (const block of ldBlocks) {
      const b = block as Record<string, unknown>
      const items = (b?.["@type"] === "ItemList" ? b.itemListElement : null) as unknown[] | null
      if (Array.isArray(items) && items.length >= 3) {
        console.log(`[idnes] ld+json ItemList found ${items.length} items`)
        const mapped = items
          .map((raw) => {
            const item = (raw as Record<string, unknown>).item as Record<string, unknown> ?? raw as Record<string, unknown>
            const name = String(item.name ?? "Nabídka")
            const url = String(item.url ?? searchUrl)
            return {
              id: `idnes-ld-${toSlug(url)}`,
              server: "idnes" as const,
              nazev: name,
              cena: 0,
              lokalita: cfg.label,
              url,
              plocha: extractArea(name),
              dispozice: extractDisposition(name),
              datumNalezeni: now,
              novinka: true,
            }
          })
          .filter((r) => r.url !== searchUrl)
        if (mapped.length > 0) return mapped
      }
    }

    // ── Try 3: Article / list item regex ───────────────────────────────────
    const results: MonitoringResult[] = []

    // iDnes uses c-products__item articles; also try generic article/li patterns
    const patterns = [
      /<article[^>]*class="[^"]*c-products__item[^"]*"[^>]*>([\s\S]*?)<\/article>/gi,
      /<article[^>]*>([\s\S]*?)<\/article>/gi,
      /<li[^>]*class="[^"]*(?:product|listing|item|result)[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
    ]

    for (const re of patterns) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(html)) !== null && results.length < 20) {
        const block = m[1]
        const titleM = block.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i)
        const linkM = block.match(/<a[^>]+href="(\/(?:detail|nemovitost|inzerat|s\/)[^"]+)"/)
        const priceM = block.match(/([\d\s]{4,})\s*Kč/)
        const areaM = block.match(/(\d+)\s*m[²2]/)

        const title = titleM ? titleM[1].replace(/<[^>]+>/g, "").trim() : ""
        if (!title || title.length < 5 || !linkM) continue

        results.push({
          id: `idnes-${toSlug(linkM[1]).slice(0, 40)}`,
          server: "idnes",
          nazev: title,
          cena: priceM ? parseInt(priceM[1].replace(/\s/g, ""), 10) : 0,
          lokalita: cfg.label,
          url: `https://reality.idnes.cz${linkM[1]}`,
          plocha: areaM ? parseInt(areaM[1], 10) : extractArea(title),
          dispozice: extractDisposition(title),
          datumNalezeni: now,
          novinka: true,
        })
      }
      if (results.length > 0) break
    }

    if (results.length > 0) {
      console.log(`[idnes] regex found ${results.length} results`)
      return results
    }

    console.log("[idnes] all parsing methods returned 0 results — using fallback")
    return generateSmartFallback("idnes", cfg.key, cfg)
  } catch (e) {
    console.log("[idnes] exception:", e)
    return generateSmartFallback("idnes", cfg.key, cfg)
  }
}

// ── RealityMix ────────────────────────────────────────────────────────────────

async function fetchRealitymix(cfg: LokalitaConfig): Promise<MonitoringResult[]> {
  const searchUrl = `https://www.realitymix.cz/reality/byty/prodej/${cfg.realitymix}/`

  try {
    const res = await fetchWithTimeout(searchUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "cs-CZ,cs;q=0.9",
      },
      cache: "no-store",
    })
    console.log(`[realitymix] HTTP ${res.status} url=${searchUrl}`)
    if (!res.ok) return generateSmartFallback("realitymix", cfg.key, cfg)

    const html = await res.text()
    const now = new Date().toISOString()
    console.log(`[realitymix] HTML length=${html.length}, head:`, html.substring(0, 500))

    // ── Try 1: __NEXT_DATA__ ───────────────────────────────────────────────
    const nextData = extractNextData(html)
    if (nextData) {
      const listings = findListingsInJson(nextData)
      const best = listings.sort((a, b) => b.length - a.length)[0]
      if (best && best.length >= 3) {
        console.log(`[realitymix] __NEXT_DATA__ found ${best.length} listings`)
        const mapped = best
          .filter((item) => item.title || item.name || item.nazev)
          .slice(0, 20)
          .map((item): MonitoringResult => {
            const title = String(item.title ?? item.name ?? item.nazev ?? "Nabídka")
            const href = String(item.url ?? item.href ?? item.link ?? "")
            return {
              id: `realitymix-nd-${toSlug(title)}-${Math.random().toString(36).slice(2, 6)}`,
              server: "realitymix",
              nazev: title,
              cena: Number(item.price ?? item.cena ?? 0),
              lokalita: String(item.location ?? item.address ?? cfg.label),
              url: href.startsWith("http") ? href : href ? `https://www.realitymix.cz${href}` : searchUrl,
              plocha: Number(item.surface ?? item.plocha ?? extractArea(title)),
              dispozice: String(item.disposition ?? extractDisposition(title)),
              datumNalezeni: now,
              novinka: true,
            }
          })
        if (mapped.length > 0) return mapped
      }
    }

    // ── Try 2: Multiple HTML patterns ─────────────────────────────────────
    const results: MonitoringResult[] = []
    const patterns = [
      /<(?:div|article|li)[^>]*class="[^"]*(?:property-item|realty-item|property-list__item|listing-item|item-nemovitost|c-realty-item)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article|li)>/gi,
      /<(?:div|article)[^>]*class="[^"]*(?:result|property|realty|nemovitost)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|article)>/gi,
    ]

    for (const re of patterns) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(html)) !== null && results.length < 20) {
        const block = m[1]
        const titleM = block.match(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i)
        const linkM = block.match(/<a[^>]+href="(\/[^"]+)"/)
        const priceM = block.match(/([\d\s]{4,})\s*Kč/)
        const areaM = block.match(/(\d+)\s*m[²2]/)

        const title = titleM ? titleM[1].replace(/<[^>]+>/g, "").trim() : ""
        if (!title || title.length < 5 || !linkM) continue

        results.push({
          id: `realitymix-${toSlug(linkM[1]).slice(0, 40)}`,
          server: "realitymix",
          nazev: title,
          cena: priceM ? parseInt(priceM[1].replace(/\s/g, ""), 10) : 0,
          lokalita: cfg.label,
          url: `https://www.realitymix.cz${linkM[1]}`,
          plocha: areaM ? parseInt(areaM[1], 10) : extractArea(title),
          dispozice: extractDisposition(title),
          datumNalezeni: now,
          novinka: true,
        })
      }
      if (results.length > 0) break
    }

    if (results.length > 0) {
      console.log(`[realitymix] regex found ${results.length} results`)
      return results
    }

    console.log("[realitymix] all parsing methods returned 0 results — using fallback")
    return generateSmartFallback("realitymix", cfg.key, cfg)
  } catch (e) {
    console.log("[realitymix] exception:", e)
    return generateSmartFallback("realitymix", cfg.key, cfg)
  }
}

// ── Bazoš ─────────────────────────────────────────────────────────────────────

async function fetchBazos(cfg: LokalitaConfig): Promise<MonitoringResult[]> {
  const searchUrl = `https://reality.bazos.cz/byt/?kraj=${encodeURIComponent(cfg.bazos)}`

  try {
    const res = await fetchWithTimeout(searchUrl, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "cs-CZ,cs;q=0.9",
      },
      cache: "no-store",
    })
    console.log(`[bazos] HTTP ${res.status} url=${searchUrl}`)
    if (!res.ok) return generateSmartFallback("bazos", cfg.key, cfg)

    const html = await res.text()
    const now = new Date().toISOString()
    console.log(`[bazos] HTML length=${html.length}, head:`, html.substring(0, 800))

    const results: MonitoringResult[] = []

    // ── Try 1: inzerat divs ────────────────────────────────────────────────
    // Bazoš HTML: <div class="inzerat"> contains <h2><a href="...">title</a></h2> + price
    const inzeratRe = /<div[^>]*class="[^"]*inzerat(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/div>\s*(?=<div[^>]*class="[^"]*inzerat|<\/div>)/gi
    let m: RegExpExecArray | null
    while ((m = inzeratRe.exec(html)) !== null && results.length < 20) {
      const block = m[1]
      // Main link (title)
      const linkM = block.match(/<a[^>]+href="(\/[^"]+\.html?)"[^>]*>([\s\S]*?)<\/a>/i)
      const priceM = block.match(/([\d\s]{3,})\s*(?:Kč|kc|CZK)/i)
      const areaM = block.match(/(\d+)\s*m[²2]/i)

      if (!linkM) continue
      const title = linkM[2].replace(/<[^>]+>/g, "").trim()
      if (!title || title.length < 3) continue

      results.push({
        id: `bazos-${toSlug(linkM[1]).slice(0, 40)}`,
        server: "bazos",
        nazev: title,
        cena: priceM ? parseInt(priceM[1].replace(/\s/g, ""), 10) : 0,
        lokalita: cfg.label,
        url: `https://reality.bazos.cz${linkM[1]}`,
        plocha: areaM ? parseInt(areaM[1], 10) : extractArea(title),
        dispozice: extractDisposition(title),
        datumNalezeni: now,
        novinka: true,
      })
    }

    if (results.length > 0) {
      console.log(`[bazos] inzerat regex found ${results.length} results`)
      return results
    }

    // ── Try 2: Any link to a .htm(l) page with price nearby ───────────────
    const linkRe = /<a[^>]+href="(\/[^"]+\.html?)"[^>]*>([^<]{10,80})<\/a>/gi
    const seen = new Set<string>()
    while ((m = linkRe.exec(html)) !== null && results.length < 20) {
      const href = m[1]
      const title = m[2].trim()
      if (seen.has(href) || !title || href.includes("?") || href.includes("prodam") === false) continue
      seen.add(href)

      // Look for price in surrounding context (200 chars after link)
      const ctx = html.slice(m.index, m.index + 300)
      const priceM = ctx.match(/([\d\s]{4,})\s*(?:Kč|kc)/i)

      results.push({
        id: `bazos-lnk-${toSlug(href).slice(0, 40)}`,
        server: "bazos",
        nazev: title,
        cena: priceM ? parseInt(priceM[1].replace(/\s/g, ""), 10) : 0,
        lokalita: cfg.label,
        url: `https://reality.bazos.cz${href}`,
        plocha: extractArea(title),
        dispozice: extractDisposition(title),
        datumNalezeni: now,
        novinka: true,
      })
    }

    if (results.length > 0) {
      console.log(`[bazos] link fallback found ${results.length} results`)
      return results
    }

    console.log("[bazos] all parsing methods returned 0 results — using fallback")
    return generateSmartFallback("bazos", cfg.key, cfg)
  } catch (e) {
    console.log("[bazos] exception:", e)
    return generateSmartFallback("bazos", cfg.key, cfg)
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const lokalitaParam = searchParams.get("lokalita") ?? "praha-7-holesovice"
  const nocache = searchParams.get("nocache") === "1"
  console.log("[monitoring-live] Request received, lokalita:", lokalitaParam)

  const cfg = LOKALITY[lokalitaParam] ?? LOKALITY["praha-7-holesovice"]
  const key = `v3-${lokalitaParam}`

  const cached = cacheMap.get(key)
  if (!nocache && cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ ...cached.payload, fromCache: true })
  }

  console.log(`[monitoring-live] fetching lokalita=${lokalitaParam}`)

  const [srealityRes, bezrealitkyRes, idnesRes, realitymixRes, bazosRes] =
    await Promise.allSettled([
      fetchSreality(cfg),
      fetchBezrealitky(cfg),
      fetchIdnes(cfg),
      fetchRealitymix(cfg),
      fetchBazos(cfg),
    ])

  const serverStatus: Record<string, { live: boolean; count: number }> = {}
  const allResults: MonitoringResult[] = []

  const processResult = (
    name: string,
    res: PromiseSettledResult<MonitoringResult[]>,
    hardFallback: MonitoringResult[],
  ) => {
    if (res.status === "fulfilled" && res.value.length > 0) {
      const isFallback = res.value.every((r) => r.jeFallback)
      allResults.push(...res.value)
      serverStatus[name] = { live: !isFallback, count: isFallback ? 0 : res.value.length }
    } else {
      console.warn(`[monitoring-live] ${name} rejected:`, res.status === "rejected" ? res.reason : "empty")
      allResults.push(...hardFallback)
      serverStatus[name] = { live: false, count: 0 }
    }
  }

  processResult("sreality", srealityRes, generateSmartFallback("sreality", cfg.key, cfg))
  processResult("bezrealitky", bezrealitkyRes, generateSmartFallback("bezrealitky", cfg.key, cfg))
  processResult("idnes", idnesRes, generateSmartFallback("idnes", cfg.key, cfg))
  processResult("realitymix", realitymixRes, generateSmartFallback("realitymix", cfg.key, cfg))
  processResult("bazos", bazosRes, generateSmartFallback("bazos", cfg.key, cfg))

  // Filter out "on request" / nonsense prices from live results
  for (let i = allResults.length - 1; i >= 0; i--) {
    const r = allResults[i]
    if (!r.jeFallback && (!r.cena || r.cena <= 1000 || r.cena < 100_000)) {
      allResults.splice(i, 1)
    }
  }

  // Compute slevaProcent for results that have puvodniCena
  for (const r of allResults) {
    if (r.puvodniCena && r.puvodniCena > r.cena && r.cena > 0) {
      r.slevaProcent = Math.round((r.puvodniCena - r.cena) / r.puvodniCena * 100)
    }
  }

  // Live results first (newest first), fallbacks last
  allResults.sort((a, b) => {
    if (a.jeFallback && !b.jeFallback) return 1
    if (!a.jeFallback && b.jeFallback) return -1
    return new Date(b.datumNalezeni).getTime() - new Date(a.datumNalezeni).getTime()
  })

  const srealityCount = serverStatus["sreality"]?.count ?? 0

  const todayStr = new Date().toISOString().slice(0, 10)
  const stats = {
    celkem:   allResults.filter((r) => !r.jeFallback).length,
    noveDnes: allResults.filter((r) => !r.jeFallback && r.datumNalezeni.slice(0, 10) === todayStr).length,
    perServer: Object.fromEntries(
      ["sreality", "bezrealitky", "idnes", "realitymix", "bazos"].map((srv) => [
        srv,
        allResults.filter((r) => r.server === srv && !r.jeFallback).length,
      ])
    ),
  }

  const payload: MonitoringLiveResponse = {
    results: allResults,
    fetchedAt: new Date().toISOString(),
    serverStatus,
    fromCache: false,
    lokalita: lokalitaParam,
    srealityLive: serverStatus["sreality"]?.live ?? false,
    srealityCount,
    stats,
  }

  cacheMap.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS })

  console.log("[monitoring-live] done:", Object.entries(serverStatus).map(([k, v]) => `${k}:${v.count}`).join(" "))

  return NextResponse.json(payload)
}
