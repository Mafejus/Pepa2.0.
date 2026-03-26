import { convertToModelMessages, stepCountIs, streamText, UIMessage, generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { monitoringResults } from "@/lib/data/monitoring"
import { auth } from "@/lib/auth"
import { getBaseUrl } from "@/lib/base-url"
import { fetchMonitoringResults } from "@/lib/monitoring-core"
import { getGoogleEvents } from "@/lib/google-calendar"

export const maxDuration = 60

const SYSTEM_PROMPT = `Jsi Pepa 2.0, AI asistent pro back-office operace realitní firmy. Komunikuješ česky, profesionálně ale přátelsky.

Tvoje schopnosti:
1. Dotazy nad firemními daty (klienti, nemovitosti, leady, prodeje)
2. Vizualizace dat (generování grafů)
3. Práce s kalendářem (hledání volných termínů, plánování, vytváření událostí)
4. Čtení a odesílání emailů přes Gmail
5. Audit nemovitostí (hledání chybějících dat)
6. Generování reportů a shrnutí
7. Monitoring realitních serverů
8. Správa poznámek a úkolů
9. Analýza nahraných souborů (CSV, XLSX, JSON, PDF)
10. Aktivní vyhledávání nemovitostí na trhu (Sreality + další servery) — včetně filtru podle vlastností (terasa, balkon, garáž…)
11. Interní dokumenty — prohledání a čtení nahraných smluv, nabídek, reportů, faktur
12. AI poradce — doporučení ke koupi nebo prodeji nemovitostí na základě analýzy trhu
13. Detekce slev — vyhledání zlevněných nemovitostí na trhu
14. Analýza trhu — průměrné ceny, trendy, investiční příležitosti pro danou lokalitu
15. Zprávy z trhu — aktuální zpravodajství o realitním trhu

Máš přístup ke Google Kalendáři a Gmail uživatele. Když uživatel chce ranní briefing nebo přehled dne, zavolej getCalendar + readEmails a shrň obojí. Při workflow "připrav email" nejdřív sestav návrh přes draftEmail, pak se zeptej, zda ho odeslat — pokud ano, použij sendGmail.

Nové nástroje — kdy je použít:
- searchDocuments/readDocument: uživatel hledá smlouvu, nabídku, fakturu nebo jakýkoli dokument
- getAdvisory(typ:"koupit"): "co koupit", "investiční příležitost", "doporuč nemovitost"
- getAdvisory(typ:"prodat"): "co prodat", "kdy prodat", "prodejní strategie portfolia"
- findDiscounts: "slevy", "zlevněné", "výhodná nabídka na trhu"
- analyzeMarket: "jak vypadá trh", "průměrné ceny", "trendy", "investice do Prahy"
- getMarketNews: "co se děje na trhu", "novinky", "aktuality z realit"

Když uživatel mluví o investicích, nákupu, prodeji nemovitostí, vždy poskytni data-driven doporučení. NIKDY si nevymýšlej ceny — vždy volej nástroje.

DŮLEŽITÉ pro emaily s termíny prohlídky: Když připravuješ email typu "prohlidka", VŽDY nejdřív zavolej getCalendar(tyden:"current", hledejVolne:true) a také getCalendar(tyden:"next", hledejVolne:true), abys získal skutečné volné termíny z reálného kalendáře (včetně Google Kalendáře). Pak použij tyto reálné termíny jako navrhovaneTerminy v draftEmail. NIKDY si nevymýšlej termíny — vždy ber z getCalendar výsledků.

Příklady workflow:
- "Ranní briefing" → getCalendar(current) + readEmails → shrnutí dne
- "Připrav email s termíny prohlídky" → getCalendar(hledejVolne:true, current) + getCalendar(hledejVolne:true, next) → draftEmail(navrhovaneTerminy: [reálné volné sloty]) → sendGmail
- "Připrav a pošli email" → draftEmail → sendGmail
- "Analyzuj soubor" → analyzeUpload → shrnutí dat
- "Přidej úkol" → createNote → potvrzení

Když uživatel hledá nemovitosti na trhu, použij tool searchRealEstate. Po získání výsledků:
1. Prezentuj top 5–10 nejzajímavějších nabídek
2. U každé uveď: název, cenu (formátovanou), plochu, dispozici, lokalitu a PŘÍMÝ ODKAZ na inzerát
3. Analyzuj výsledky — porovnej ceny za m², vyzdvihni výhodné nabídky, upozorni na předražené
4. Na konci nabídni odkazy na další servery kde může uživatel hledat
5. Zeptej se jestli chce upravit kritéria nebo hledat jinde
6. NIKDY nedoporučuj nemovitosti s cenou pod 100 000 Kč — to jsou nemovitosti "na vyžádání" bez reálné ceny

Když uživatel hledá nemovitost, rozuměj přirozenému jazyku:
- 'chci byt s terasou do 8 milionů v Praze' → searchRealEstate({ typ: 'byt', maxCena: 8000000, vlastnosti: ['terasa'], lokalita: 'Praha' })
- 'něco většího pro rodinu v Holešovicích' → searchRealEstate({ typ: 'byt', minPlocha: 80, dispozice: '3+kk', lokalita: 'Praha 7 Holešovice' })
- 'investiční byt do 4M' → searchRealEstate({ typ: 'byt', maxCena: 4000000, razeni: 'cena_za_m2' })
- 'dům se zahradou mimo Prahu' → searchRealEstate({ typ: 'dum', vlastnosti: ['zahrada'], lokalita: 'Středočeský kraj' })
- 'Najdi mi byt 3+kk v Holešovicích do 8 milionů' → searchRealEstate s parametry
- 'Co je teď na Sreality v Praze 3?' → searchRealEstate s lokalitou
- 'Hledám investiční byt do 5M' → searchRealEstate s maxCena=5000000

Po vrácení výsledků searchRealEstate VŽDY:
1. Analyzuj výsledky z pohledu investora/kupce
2. Vyzdvihni top 3 nejzajímavější a řekni PROČ
3. Porovnej ceny za m² mezi výsledky
4. Pokud uživatel hledal specifické vlastnosti a nenašly se, navrhni alternativy
5. Nabídni odkaz na další servery

Umíš pracovat s CRM daty — vytvářet, editovat a hledat klienty, leady a prodeje. Příklady:
- "Přidej nového klienta Jana Nováka, telefon 777123456, je to kupující z doporučení" → createClient
- "Přesuň lead Nováka do fáze vyjednávání" → updateLead
- "Zapiš prodej bytu v Holešovicích za 5.5M, kupující Novák, prodávající Dvořák, provize 165000" → createSale
- "Vytvoř lead pro klienta Svoboda na byt v Žižkově, hodnota 4M" → createLead
- "Aktualizuj status Novákovi na aktivní" → updateClient
Vždy potvrď co jsi udělal a shrň výsledek. Při nejasnostech se zeptej — raději se zeptej než udělej chybu v datech.

Když odpovídáš:
- Vždy používej nástroje (tools) k získání dat — NIKDY si data nevymýšlej
- Formátuj čísla česky (1 500 000 Kč, 85 m²)
- Datumy formátuj česky (15. března 2025)
- Buď konkrétní a přesný, cituj přesná čísla z dat
- Když ti uživatel řekne "znázorni graficky", "vytvoř graf" nebo "vizualizuj", použij tool generateChart
- Když nemáš dost informací, zeptej se
- Po zavolání nástroje vždy shrň výsledky v přátelském textu

Umíš přiřazovat úkoly zaměstnancům týmu. Členové týmu: Jana Dvořáková (obchodní makléřka), Martin Svoboda (obchodní makléř). Příklady:
- "Přiřaď Janě prohlídku bytu v Holešovicích na čtvrtek" → assignTask + createCalendarEvent
- "Co dělá Martin? Jaké má úkoly?" → getTeamTasks
- "Dej Martinovi za úkol najít byt v Holešovicích do 6M" → assignTask
- "Jaké úkoly jsou nesplněné?" → getTeamTasks se status="novy"
Když přiřazuješ úkol, vždy potvrď komu a co jsi přiřadil.`

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const today = new Date()
  const formattedDate = today.toLocaleDateString("cs-CZ", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
  const systemWithDate = `Dnešní datum je: ${formattedDate}. Aktuální rok je ${today.getFullYear()}. Když mluvíš o "tomto týdnu", "minulém měsíci" atd., vždy počítej od tohoto data.\n\n${SYSTEM_PROMPT}`

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemWithDate,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: {
      queryClients: {
        description:
          "Vyhledá a filtruje klienty podle zadaných kritérií. Použij pro dotazy typu 'jaké máme nové klienty', 'klienti za Q1', 'odkud přicházejí klienti'.",
        inputSchema: z.object({
          kvartal: z
            .string()
            .optional()
            .describe("Kvartál ve formátu Q1-2025, Q2-2024 atd."),
          zdroj: z
            .enum([
              "sreality",
              "bezrealitky",
              "doporuceni",
              "facebook",
              "web",
              "cold-call",
            ])
            .optional()
            .describe("Zdroj klienta"),
          status: z
            .enum(["novy", "aktivni", "uzavreny", "neaktivni"])
            .optional()
            .describe("Status klienta"),
          rok: z.number().optional().describe("Rok prvního kontaktu"),
        }),
        execute: async ({ kvartal, zdroj, status, rok }) => {
          const where: Record<string, unknown> = {}

          if (kvartal) {
            const [q, year] = kvartal.split("-")
            const qNum = parseInt(q.replace("Q", ""))
            const yearNum = parseInt(year)
            const monthStart = (qNum - 1) * 3
            where.datumPrvnihoKontaktu = {
              gte: new Date(yearNum, monthStart, 1),
              lt: new Date(yearNum, monthStart + 3, 1),
            }
          } else if (rok) {
            where.datumPrvnihoKontaktu = {
              gte: new Date(rok, 0, 1),
              lt: new Date(rok + 1, 0, 1),
            }
          }

          if (zdroj) where.zdroj = zdroj
          if (status) where.status = status

          const clients = await prisma.client.findMany({
            where,
            orderBy: { datumPrvnihoKontaktu: "desc" },
          })

          const zdrojBreakdown: Record<string, number> = {}
          const typBreakdown: Record<string, number> = {}
          clients.forEach((c) => {
            zdrojBreakdown[c.zdroj] = (zdrojBreakdown[c.zdroj] || 0) + 1
            typBreakdown[c.typ] = (typBreakdown[c.typ] || 0) + 1
          })

          return {
            clients: clients.map((c) => ({
              ...c,
              datumPrvnihoKontaktu: c.datumPrvnihoKontaktu.toISOString(),
              createdAt: c.createdAt.toISOString(),
              updatedAt: c.updatedAt.toISOString(),
            })),
            totalCount: clients.length,
            summary: { zdrojBreakdown, typBreakdown },
          }
        },
      },

      queryProperties: {
        description:
          "Vyhledá nemovitosti podle kritérií. Použij pro dotazy o nemovitostech, cenách, dostupnosti.",
        inputSchema: z.object({
          typ: z
            .enum(["byt", "dum", "pozemek", "komercni"])
            .optional()
            .describe("Typ nemovitosti"),
          stav: z
            .enum(["aktivni", "prodano", "rezervovano", "pripravuje_se"])
            .optional()
            .describe("Stav nemovitosti"),
          lokalita: z
            .string()
            .optional()
            .describe("Lokalita nebo část lokality"),
          minCena: z.number().optional().describe("Minimální cena v CZK"),
          maxCena: z.number().optional().describe("Maximální cena v CZK"),
        }),
        execute: async ({ typ, stav, lokalita, minCena, maxCena }) => {
          const where: Record<string, unknown> = {}

          if (typ) where.typ = typ
          if (stav) where.stav = stav
          if (lokalita) where.lokalita = { contains: lokalita, mode: "insensitive" }
          if (minCena !== undefined || maxCena !== undefined) {
            where.cena = {
              ...(minCena !== undefined ? { gte: minCena } : {}),
              ...(maxCena !== undefined ? { lte: maxCena } : {}),
            }
          }

          const properties = await prisma.property.findMany({
            where,
            orderBy: { datumNasazeni: "desc" },
          })

          const ceny = properties.map((p) => p.cena).sort((a, b) => a - b)
          const cenaPrumer =
            ceny.length > 0
              ? Math.round(ceny.reduce((s, c) => s + c, 0) / ceny.length)
              : 0
          const cenaMedian =
            ceny.length > 0 ? ceny[Math.floor(ceny.length / 2)] : 0

          return {
            properties: properties.map((p) => ({
              ...p,
              datumNasazeni: p.datumNasazeni.toISOString(),
              createdAt: p.createdAt.toISOString(),
              updatedAt: p.updatedAt.toISOString(),
            })),
            totalCount: properties.length,
            cenaPrumer,
            cenaMedian,
          }
        },
      },

      queryLeadsAndSales: {
        description:
          "Získá data o leadech a prodejích za zadané období. Použij pro reporty, grafy vývoje, statistiky pipeline.",
        inputSchema: z.object({
          obdobiOd: z
            .string()
            .optional()
            .describe("Začátek období jako ISO datum"),
          obdobiDo: z
            .string()
            .optional()
            .describe("Konec období jako ISO datum"),
          pocetMesicu: z
            .number()
            .optional()
            .describe("Posledních N měsíců"),
        }),
        execute: async ({ obdobiOd, obdobiDo, pocetMesicu }) => {
          let dateFrom: Date | undefined
          let dateTo: Date | undefined

          if (pocetMesicu) {
            dateTo = new Date()
            dateFrom = new Date()
            dateFrom.setMonth(dateFrom.getMonth() - pocetMesicu)
          } else {
            if (obdobiOd) dateFrom = new Date(obdobiOd)
            if (obdobiDo) dateTo = new Date(obdobiDo)
          }

          const leadsWhere: Record<string, unknown> = {}
          if (dateFrom || dateTo) {
            leadsWhere.datumVytvoreni = {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            }
          }

          const salesWhere: Record<string, unknown> = {}
          if (dateFrom || dateTo) {
            salesWhere.datumProdeje = {
              ...(dateFrom ? { gte: dateFrom } : {}),
              ...(dateTo ? { lte: dateTo } : {}),
            }
          }

          const [leads, sales] = await Promise.all([
            prisma.lead.findMany({ where: leadsWhere, orderBy: { datumVytvoreni: "desc" } }),
            prisma.sale.findMany({ where: salesWhere, orderBy: { datumProdeje: "desc" } }),
          ])

          const leadsByMonth: Record<string, number> = {}
          const salesByMonth: Record<string, number> = {}

          leads.forEach((l) => {
            const key = l.datumVytvoreni.toISOString().slice(0, 7)
            leadsByMonth[key] = (leadsByMonth[key] || 0) + 1
          })
          sales.forEach((s) => {
            const key = s.datumProdeje.toISOString().slice(0, 7)
            salesByMonth[key] = (salesByMonth[key] || 0) + 1
          })

          const uzavrenychLeadu = leads.filter((l) => l.status === "uzavreno").length
          const conversionRate =
            leads.length > 0
              ? Math.round((uzavrenychLeadu / leads.length) * 100)
              : 0
          const celkovaTrzba = sales.reduce((sum, s) => sum + s.provize, 0)

          return {
            leads: leads.map((l) => ({
              ...l,
              datumVytvoreni: l.datumVytvoreni.toISOString(),
              datumAktualizace: l.datumAktualizace.toISOString(),
              createdAt: l.createdAt.toISOString(),
              updatedAt: l.updatedAt.toISOString(),
            })),
            sales: sales.map((s) => ({
              ...s,
              datumProdeje: s.datumProdeje.toISOString(),
              createdAt: s.createdAt.toISOString(),
              updatedAt: s.updatedAt.toISOString(),
            })),
            leadsByMonth,
            salesByMonth,
            conversionRate,
            celkovaTrzba,
          }
        },
      },

      getCalendar: {
        description:
          "Získá kalendářní události a najde volné termíny. Použij když uživatel chce naplánovat prohlídku, najít volný čas, nebo vidět svůj rozvrh.",
        inputSchema: z.object({
          tyden: z
            .enum(["current", "next"])
            .optional()
            .describe("Aktuální nebo příští týden"),
          hledejVolne: z
            .boolean()
            .optional()
            .describe("Pokud true, vrátí i volné sloty"),
          den: z
            .string()
            .optional()
            .describe("Konkrétní den jako ISO datum"),
        }),
        execute: async ({ tyden, hledejVolne, den }) => {
          console.log("[getCalendar] called, tyden:", tyden, "hledejVolne:", hledejVolne, "den:", den)

          const now = new Date()
          let timeMin: string
          let timeMax: string

          if (den) {
            const d = new Date(den)
            d.setHours(0, 0, 0, 0)
            timeMin = d.toISOString()
            const end = new Date(d)
            end.setHours(23, 59, 59, 999)
            timeMax = end.toISOString()
          } else if (tyden === "next") {
            const start = new Date(now)
            start.setDate(start.getDate() + (7 - start.getDay() + 1))
            start.setHours(0, 0, 0, 0)
            timeMin = start.toISOString()
            const end = new Date(start)
            end.setDate(end.getDate() + 6)
            end.setHours(23, 59, 59, 999)
            timeMax = end.toISOString()
          } else {
            // Current week — Monday to Sunday
            const start = new Date(now)
            start.setDate(start.getDate() - start.getDay() + 1)
            start.setHours(0, 0, 0, 0)
            timeMin = start.toISOString()
            const end = new Date(start)
            end.setDate(end.getDate() + 6)
            end.setHours(23, 59, 59, 999)
            timeMax = end.toISOString()
          }

          type CalEvent = {
            id: string; nazev: string; typ: string; zacatek: string; konec: string;
            lokace: string | null; ucastnici: string[]; poznamka: string | null;
            zdroj: string; googleEventId?: string | null;
          }
          const events: CalEvent[] = []
          const seenGoogleIds = new Set<string>()

          // 1. Google Calendar (direct API call — no self-fetch)
          try {
            const googleEvents = await getGoogleEvents(timeMin, timeMax)
            for (const e of googleEvents) {
              if (e.googleEventId) seenGoogleIds.add(e.googleEventId)
              events.push({ ...e, zdroj: "google" })
            }
            console.log(`[getCalendar] Google Calendar returned ${googleEvents.length} events`)
          } catch (err) {
            console.error("[getCalendar] Google Calendar error:", err instanceof Error ? err.message : String(err))
          }

          // 2. DB events (skip those already synced from Google)
          try {
            const dbEvents = await prisma.calendarEvent.findMany({
              where: { zacatek: { gte: new Date(timeMin), lte: new Date(timeMax) } },
              orderBy: { zacatek: "asc" },
            })
            for (const dbEvt of dbEvents) {
              if (dbEvt.googleEventId && seenGoogleIds.has(dbEvt.googleEventId)) continue
              events.push({
                id: dbEvt.id,
                nazev: dbEvt.nazev,
                typ: dbEvt.typ,
                zacatek: dbEvt.zacatek.toISOString(),
                konec: dbEvt.konec.toISOString(),
                lokace: dbEvt.lokace ?? null,
                ucastnici: dbEvt.ucastnici,
                poznamka: dbEvt.poznamka ?? null,
                zdroj: "pepa",
                googleEventId: dbEvt.googleEventId ?? null,
              })
            }
            console.log(`[getCalendar] DB returned ${dbEvents.length} events`)
          } catch (err) {
            console.error("[getCalendar] DB error:", err instanceof Error ? err.message : String(err))
          }

          // 3. Sort by start time
          events.sort((a, b) => new Date(a.zacatek).getTime() - new Date(b.zacatek).getTime())

          // 4. Free slots (9:00–17:00, next 7 weekdays)
          let freeSlots: Array<{ den: string; zacatek: string; konec: string; denLabel: string }> = []
          if (hledejVolne) {
            for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
              const day = new Date(now)
              day.setDate(day.getDate() + dayOffset)
              if (day.getDay() === 0 || day.getDay() === 6) continue
              const dayStr = day.toISOString().slice(0, 10)
              const dayEvents = events.filter((e) => e.zacatek.startsWith(dayStr))

              for (let hour = 9; hour < 17; hour++) {
                const slotStart = new Date(day)
                slotStart.setHours(hour, 0, 0, 0)
                const slotEnd = new Date(day)
                slotEnd.setHours(hour + 1, 0, 0, 0)
                const isOccupied = dayEvents.some((e) => {
                  const eStart = new Date(e.zacatek).getTime()
                  const eEnd = new Date(e.konec).getTime()
                  return eStart < slotEnd.getTime() && eEnd > slotStart.getTime()
                })
                if (!isOccupied) {
                  freeSlots.push({
                    den: dayStr,
                    zacatek: slotStart.toISOString(),
                    konec: slotEnd.toISOString(),
                    denLabel: day.toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long" }),
                  })
                }
              }
            }
          }

          return {
            events,
            celkem: events.length,
            freeSlots: hledejVolne ? freeSlots : undefined,
          }
        },
      },

      createCalendarEvent: {
        description:
          "Vytvoří novou událost v kalendáři (a v Google Kalendáři pokud je připojený). Použij když uživatel chce naplánovat prohlídku, meeting, nebo jinou událost.",
        inputSchema: z.object({
          nazev: z.string().describe("Název události"),
          datum: z.string().describe("Datum ve formátu YYYY-MM-DD"),
          casOd: z.string().describe("Čas začátku ve formátu HH:MM"),
          casDo: z.string().describe("Čas konce ve formátu HH:MM"),
          typ: z
            .enum(["prohlidka", "meeting", "foceni", "administrativa", "jine"])
            .optional()
            .describe("Typ události"),
          lokace: z.string().optional().describe("Místo konání"),
          popis: z.string().optional().describe("Popis nebo poznámka"),
          ucastnici: z
            .array(z.string())
            .optional()
            .describe("Emaily účastníků"),
        }),
        execute: async ({ nazev, datum, casOd, casDo, typ, lokace, popis, ucastnici }) => {
          const zacatek = `${datum}T${casOd}:00Z`
          const konec = `${datum}T${casDo}:00Z`

          const baseUrl = getBaseUrl()

          try {
            const res = await fetch(`${baseUrl}/api/calendar`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nazev,
                typ: typ ?? "jine",
                zacatek,
                konec,
                lokace,
                poznamka: popis,
                ucastnici: ucastnici ?? [],
              }),
            })

            if (!res.ok) throw new Error("Failed to create event")
            const event = await res.json()

            return {
              success: true,
              event,
              googleEventId: event.googleEventId ?? null,
              message: event.googleEventId
                ? `Událost "${nazev}" byla vytvořena v kalendáři i v Google Kalendáři.`
                : `Událost "${nazev}" byla vytvořena v kalendáři (Google Kalendář není připojený).`,
            }
          } catch (err) {
            return {
              success: false,
              message: `Nepodařilo se vytvořit událost: ${err}`,
            }
          }
        },
      },

      draftEmail: {
        description:
          "Připraví návrh emailu. Použij když uživatel chce napsat email klientovi, zájemci, nebo jinému příjemci.",
        inputSchema: z.object({
          komu: z.string().describe("Jméno nebo email příjemce"),
          predmet: z.string().describe("Předmět emailu"),
          typ: z
            .enum(["prohlidka", "nabidka", "followup", "info", "jiny"])
            .describe("Typ emailu"),
          kontext: z.string().describe("Co má email obsahovat"),
          navrhovaneTerminy: z
            .array(z.string())
            .optional()
            .describe("Navrhované termíny prohlídky"),
        }),
        execute: async ({
          komu,
          predmet,
          typ,
          kontext,
          navrhovaneTerminy,
        }) => {
          // For viewing appointments, auto-fetch real free slots from Google Calendar if none provided
          let realTerminy = navrhovaneTerminy ?? []
          if (typ === "prohlidka" && realTerminy.length === 0) {
            try {
              const now = new Date()
              // Fetch 2 weeks of events to find free slots
              const twoWeeksLater = new Date(now)
              twoWeeksLater.setDate(twoWeeksLater.getDate() + 14)
              const existingEvents = await getGoogleEvents(now.toISOString(), twoWeeksLater.toISOString())

              const slots: { zacatek: Date }[] = []
              for (let dayOffset = 0; dayOffset < 14 && slots.length < 4; dayOffset++) {
                const day = new Date(now)
                day.setDate(day.getDate() + dayOffset)
                if (day.getDay() === 0 || day.getDay() === 6) continue
                const dayStr = day.toISOString().slice(0, 10)
                const dayEvents = existingEvents.filter((e) => e.zacatek.startsWith(dayStr))

                for (let hour = 9; hour < 17 && slots.length < 4; hour++) {
                  const slotStart = new Date(day)
                  slotStart.setHours(hour, 0, 0, 0)
                  const slotEnd = new Date(day)
                  slotEnd.setHours(hour + 1, 0, 0, 0)
                  const isOccupied = dayEvents.some((e) => {
                    const eStart = new Date(e.zacatek).getTime()
                    const eEnd = new Date(e.konec).getTime()
                    return eStart < slotEnd.getTime() && eEnd > slotStart.getTime()
                  })
                  if (!isOccupied) slots.push({ zacatek: slotStart })
                }
              }

              realTerminy = slots.map(({ zacatek }) => {
                const dateStr = zacatek.toLocaleDateString("cs-CZ", {
                  weekday: "long", day: "numeric", month: "long",
                })
                const timeStr = zacatek.toLocaleTimeString("cs-CZ", {
                  hour: "2-digit", minute: "2-digit", timeZone: "Europe/Prague",
                })
                return `${dateStr} v ${timeStr}`
              })
            } catch {
              // Calendar unavailable — continue without terms
            }
          }

          const terminyText =
            realTerminy.length > 0
              ? `\n\nNavrhujeme Vám tyto termíny prohlídky:\n${realTerminy.map((t: string, i: number) => `  ${i + 1}. ${t}`).join("\n")}\n\nProsím dejte nám vědět, který termín Vám vyhovuje, nebo navrhněte jiný dle Vaší dostupnosti.`
              : ""

          let intro = ""
          let body = ""
          let closing = ""

          switch (typ) {
            case "prohlidka":
              intro = `Dobrý den, ${komu},`
              body = `rád bych Vás pozval na prohlídku nemovitosti, která by mohla odpovídat Vašim požadavkům.\n\n${kontext}${terminyText}`
              closing =
                "Těším se na Vaši odpověď a případné setkání u prohlídky."
              break
            case "nabidka":
              intro = `Vážený/á ${komu},`
              body = `dovolujeme si Vám předložit nabídku, která může odpovídat Vašim potřebám.\n\n${kontext}`
              closing =
                "Jsme připraveni zodpovědět veškeré Vaše dotazy a domluvit se na dalším postupu."
              break
            case "followup":
              intro = `Dobrý den, ${komu},`
              body = `navazuji na naše předchozí jednání a rád bych Vám sdělil aktuální informace.\n\n${kontext}`
              closing = "Budu rád za Vaši zpětnou vazbu."
              break
            default:
              intro = `Dobrý den, ${komu},`
              body = kontext
              closing = "Jsme k dispozici pro jakékoli dotazy."
          }

          const emailBody = `${intro}\n\n${body}\n\n${closing}\n\nS přátelským pozdravem,\nPepa Novák\nBack Office Manager\nPepa Realitní s.r.o.\ntel.: +420 721 000 100`

          return {
            to: komu,
            subject: predmet,
            body: emailBody,
            suggestedTerminy: realTerminy,
          }
        },
      },

      auditProperties: {
        description:
          "Provede audit nemovitostí a najde ty s chybějícími nebo neúplnými údaji. Použij pro kontrolu dat, hledání chybějících informací.",
        inputSchema: z.object({
          typAuditu: z
            .enum([
              "rekonstrukce",
              "stavebni_upravy",
              "energetika",
              "fotky",
              "kompletni",
            ])
            .describe("Typ auditu"),
        }),
        execute: async ({ typAuditu }) => {
          const orConditions: Record<string, unknown>[] = []

          if (typAuditu === "rekonstrukce" || typAuditu === "kompletni") {
            orConditions.push({ rokRekonstrukce: null })
          }
          if (typAuditu === "stavebni_upravy" || typAuditu === "kompletni") {
            orConditions.push({ stavebniUpravy: null })
          }
          if (typAuditu === "energetika" || typAuditu === "kompletni") {
            orConditions.push({ energetickaTrida: null })
          }
          if (typAuditu === "fotky" || typAuditu === "kompletni") {
            orConditions.push({ fotky: false })
            orConditions.push({ popisPopis: false })
          }

          const [chybejiciProps, totalCount] = await Promise.all([
            prisma.property.findMany({
              where: { OR: orConditions },
              orderBy: { datumNasazeni: "desc" },
            }),
            prisma.property.count(),
          ])

          const result = chybejiciProps.map((p) => {
            const chybejici: string[] = []
            if ((typAuditu === "rekonstrukce" || typAuditu === "kompletni") && p.rokRekonstrukce === null)
              chybejici.push("Rok rekonstrukce")
            if ((typAuditu === "stavebni_upravy" || typAuditu === "kompletni") && p.stavebniUpravy === null)
              chybejici.push("Stavební úpravy")
            if ((typAuditu === "energetika" || typAuditu === "kompletni") && p.energetickaTrida === null)
              chybejici.push("Energetická třída")
            if ((typAuditu === "fotky" || typAuditu === "kompletni") && !p.fotky)
              chybejici.push("Fotografie")
            if ((typAuditu === "fotky" || typAuditu === "kompletni") && !p.popisPopis)
              chybejici.push("Popis nemovitosti")
            return {
              property: {
                ...p,
                datumNasazeni: p.datumNasazeni.toISOString(),
                createdAt: p.createdAt.toISOString(),
                updatedAt: p.updatedAt.toISOString(),
              },
              chybejiciPole: chybejici,
            }
          })

          const doporuceni: Record<string, string> = {
            rekonstrukce:
              "Kontaktujte majitele a zjistěte rok poslední rekonstrukce nebo potvrďte, že k rekonstrukci nedošlo.",
            stavebni_upravy:
              "Doplňte informace o stavebních úpravách do systému nebo potvrďte, že žádné neproběhly.",
            energetika:
              "Zajistěte vystavení průkazu energetické náročnosti budovy (PENB) — nutný při prodeji.",
            fotky:
              "Objednejte profesionálního fotografa pro nemovitosti bez fotek a doplňte popis.",
            kompletni:
              "Kontaktujte makléře přiřazené k jednotlivým nemovitostem a naplánujte doplnění chybějících údajů.",
          }

          return {
            chybejici: result,
            celkemNemovitosti: totalCount,
            celkemSChybou: result.length,
            doporuceniDalsiKrok: doporuceni[typAuditu],
          }
        },
      },

      generateChart: {
        description:
          "Vygeneruje data pro graf/vizualizaci. Použij VŽDY když uživatel chce graf, vizualizaci nebo grafické znázornění dat.",
        inputSchema: z.object({
          typGrafu: z
            .enum(["bar", "line", "pie", "area"])
            .describe("Typ grafu"),
          nazev: z.string().describe("Titulek grafu"),
          dataset: z
            .enum([
              "clients_by_source",
              "clients_by_quarter",
              "leads_by_month",
              "sales_by_month",
              "leads_vs_sales",
              "property_types",
              "property_status",
              "revenue_by_month",
            ])
            .describe("Datová sada"),
          obdobiMesicu: z
            .number()
            .optional()
            .describe("Kolik měsíců zpět"),
        }),
        execute: async ({ typGrafu, nazev, dataset, obdobiMesicu }) => {
          let data: Array<Record<string, string | number>> = []
          const ZDROJ_LABELS: Record<string, string> = {
            sreality: "Sreality",
            bezrealitky: "Bezrealitky",
            doporuceni: "Doporučení",
            facebook: "Facebook",
            web: "Web",
            "cold-call": "Cold call",
          }

          switch (dataset) {
            case "clients_by_source": {
              const clients = await prisma.client.findMany({ select: { zdroj: true } })
              const breakdown: Record<string, number> = {}
              clients.forEach((c) => {
                breakdown[c.zdroj] = (breakdown[c.zdroj] || 0) + 1
              })
              data = Object.entries(breakdown).map(([zdroj, count]) => ({
                name: ZDROJ_LABELS[zdroj] || zdroj,
                value: count,
              }))
              break
            }
            case "clients_by_quarter": {
              const clients = await prisma.client.findMany({
                select: { datumPrvnihoKontaktu: true },
              })
              const qBreakdown: Record<string, number> = {}
              clients.forEach((c) => {
                const d = c.datumPrvnihoKontaktu
                const q = Math.floor(d.getMonth() / 3) + 1
                const key = `Q${q} ${d.getFullYear()}`
                qBreakdown[key] = (qBreakdown[key] || 0) + 1
              })
              data = Object.entries(qBreakdown)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([period, count]) => ({ name: period, value: count }))
              break
            }
            case "leads_by_month": {
              const months = obdobiMesicu || 6
              const now = new Date()
              const dateFrom = new Date(now)
              dateFrom.setMonth(dateFrom.getMonth() - months)
              const leads = await prisma.lead.findMany({
                select: { datumVytvoreni: true },
                where: { datumVytvoreni: { gte: dateFrom } },
              })
              const breakdown: Record<string, number> = {}
              for (let i = months - 1; i >= 0; i--) {
                const d = new Date(now)
                d.setMonth(d.getMonth() - i)
                breakdown[d.toISOString().slice(0, 7)] = 0
              }
              leads.forEach((l) => {
                const key = l.datumVytvoreni.toISOString().slice(0, 7)
                if (key in breakdown) breakdown[key]++
              })
              data = Object.entries(breakdown).map(([month, count]) => ({
                name: month,
                value: count,
              }))
              break
            }
            case "sales_by_month": {
              const months = obdobiMesicu || 6
              const now = new Date()
              const dateFrom = new Date(now)
              dateFrom.setMonth(dateFrom.getMonth() - months)
              const sales = await prisma.sale.findMany({
                select: { datumProdeje: true },
                where: { datumProdeje: { gte: dateFrom } },
              })
              const breakdown: Record<string, number> = {}
              for (let i = months - 1; i >= 0; i--) {
                const d = new Date(now)
                d.setMonth(d.getMonth() - i)
                breakdown[d.toISOString().slice(0, 7)] = 0
              }
              sales.forEach((s) => {
                const key = s.datumProdeje.toISOString().slice(0, 7)
                if (key in breakdown) breakdown[key]++
              })
              data = Object.entries(breakdown).map(([month, count]) => ({
                name: month,
                value: count,
              }))
              break
            }
            case "leads_vs_sales": {
              const months = obdobiMesicu || 6
              const now = new Date()
              const dateFrom = new Date(now)
              dateFrom.setMonth(dateFrom.getMonth() - months)
              const [leads, sales] = await Promise.all([
                prisma.lead.findMany({
                  select: { datumVytvoreni: true },
                  where: { datumVytvoreni: { gte: dateFrom } },
                }),
                prisma.sale.findMany({
                  select: { datumProdeje: true },
                  where: { datumProdeje: { gte: dateFrom } },
                }),
              ])
              const leadsMap: Record<string, number> = {}
              const salesMap: Record<string, number> = {}
              for (let i = months - 1; i >= 0; i--) {
                const d = new Date(now)
                d.setMonth(d.getMonth() - i)
                const key = d.toISOString().slice(0, 7)
                leadsMap[key] = 0
                salesMap[key] = 0
              }
              leads.forEach((l) => {
                const key = l.datumVytvoreni.toISOString().slice(0, 7)
                if (key in leadsMap) leadsMap[key]++
              })
              sales.forEach((s) => {
                const key = s.datumProdeje.toISOString().slice(0, 7)
                if (key in salesMap) salesMap[key]++
              })
              data = Object.keys(leadsMap).map((month) => ({
                name: month,
                leady: leadsMap[month],
                prodeje: salesMap[month],
              }))
              break
            }
            case "property_types": {
              const properties = await prisma.property.findMany({ select: { typ: true } })
              const labels: Record<string, string> = {
                byt: "Byty",
                dum: "Domy",
                pozemek: "Pozemky",
                komercni: "Komerční",
              }
              const breakdown: Record<string, number> = {}
              properties.forEach((p) => {
                const key = labels[p.typ] || p.typ
                breakdown[key] = (breakdown[key] || 0) + 1
              })
              data = Object.entries(breakdown).map(([name, value]) => ({
                name,
                value,
              }))
              break
            }
            case "property_status": {
              const properties = await prisma.property.findMany({ select: { stav: true } })
              const labels: Record<string, string> = {
                aktivni: "Aktivní",
                prodano: "Prodáno",
                rezervovano: "Rezervováno",
                pripravuje_se: "Připravuje se",
              }
              const breakdown: Record<string, number> = {}
              properties.forEach((p) => {
                const key = labels[p.stav] || p.stav
                breakdown[key] = (breakdown[key] || 0) + 1
              })
              data = Object.entries(breakdown).map(([name, value]) => ({
                name,
                value,
              }))
              break
            }
            case "revenue_by_month": {
              const months = obdobiMesicu || 6
              const now = new Date()
              const dateFrom = new Date(now)
              dateFrom.setMonth(dateFrom.getMonth() - months)
              const sales = await prisma.sale.findMany({
                select: { datumProdeje: true, provize: true },
                where: { datumProdeje: { gte: dateFrom } },
              })
              const breakdown: Record<string, number> = {}
              for (let i = months - 1; i >= 0; i--) {
                const d = new Date(now)
                d.setMonth(d.getMonth() - i)
                breakdown[d.toISOString().slice(0, 7)] = 0
              }
              sales.forEach((s) => {
                const key = s.datumProdeje.toISOString().slice(0, 7)
                if (key in breakdown) breakdown[key] += s.provize
              })
              data = Object.entries(breakdown).map(([month, value]) => ({
                name: month,
                value: Math.round(value),
              }))
              break
            }
          }

          return {
            chartType: typGrafu,
            title: nazev,
            data,
            xAxisKey: "name",
            yAxisKey: "value",
            yAxisKey2:
              dataset === "leads_vs_sales"
                ? { leady: "leady", prodeje: "prodeje" }
                : undefined,
          }
        },
      },

      generateReport: {
        description:
          "Vygeneruje report/shrnutí za zadané období. Použij pro týdenní/měsíční reporty, shrnutí pro vedení.",
        inputSchema: z.object({
          typ: z
            .enum(["tydenni", "mesicni", "kvartalni", "custom"])
            .describe("Typ reportu"),
          obdobiOd: z
            .string()
            .optional()
            .describe("Začátek období jako ISO datum"),
          obdobiDo: z
            .string()
            .optional()
            .describe("Konec období jako ISO datum"),
        }),
        execute: async ({ typ, obdobiOd, obdobiDo }) => {
          const now = new Date()
          let dateFrom: Date
          let dateTo: Date = now

          switch (typ) {
            case "tydenni":
              dateFrom = new Date(now)
              dateFrom.setDate(now.getDate() - 7)
              break
            case "mesicni":
              dateFrom = new Date(now)
              dateFrom.setMonth(now.getMonth() - 1)
              break
            case "kvartalni":
              dateFrom = new Date(now)
              dateFrom.setMonth(now.getMonth() - 3)
              break
            default:
              dateFrom = obdobiOd ? new Date(obdobiOd) : new Date(new Date().setMonth(now.getMonth() - 1))
              dateTo = obdobiDo ? new Date(obdobiDo) : new Date()
          }

          const [periodLeads, periodSales, periodEvents, periodClients] = await Promise.all([
            prisma.lead.findMany({ where: { datumVytvoreni: { gte: dateFrom, lte: dateTo } } }),
            prisma.sale.findMany({ where: { datumProdeje: { gte: dateFrom, lte: dateTo } }, include: { property: true } }),
            prisma.calendarEvent.findMany({ where: { zacatek: { gte: dateFrom, lte: dateTo } } }),
            prisma.client.findMany({ where: { datumPrvnihoKontaktu: { gte: dateFrom, lte: dateTo } } }),
          ])

          const trzba = periodSales.reduce((sum, s) => sum + s.provize, 0)
          const provedeneProhlidky = periodEvents.filter((e) => e.typ === "prohlidka").length
          const uzavrenoLeadu = periodLeads.filter((l) => l.status === "uzavreno").length
          const konverzniPomer = periodLeads.length > 0 ? Math.round((uzavrenoLeadu / periodLeads.length) * 100) : 0

          const statusBreakdown = periodLeads.reduce((acc: Record<string, number>, l) => {
            acc[l.status] = (acc[l.status] || 0) + 1
            return acc
          }, {})
          const statusLabels: Record<string, string> = {
            novy: "Nové", kontaktovan: "Kontaktováni", prohlidka_domluvena: "Prohlídka",
            nabidka_odeslana: "Nabídka", vyjednavani: "Vyjednávání", uzavreno: "Uzavřeno", ztraceno: "Ztraceno",
          }

          const formatDate = (d: Date) => d.toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })
          const formatCZK = (n: number) => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 }).format(n)

          const reportNazev =
            typ === "tydenni" ? "Týdenní report" :
            typ === "mesicni" ? "Měsíční report" :
            typ === "kvartalni" ? "Kvartální report" : "Report"

          // ── AI-generated slide content ─────────────────────────────────────────
          const statsContext = `
Období: ${formatDate(dateFrom)} – ${formatDate(dateTo)}
Nové leady: ${periodLeads.length} | Uzavřeno: ${uzavrenoLeadu} | Konverzní poměr: ${konverzniPomer}%
Pipeline: ${Object.entries(statusBreakdown).map(([k, v]) => `${statusLabels[k] || k}: ${v}`).join(", ")}
Prodeje: ${periodSales.length} obchodů | Tržby (provize): ${formatCZK(trzba)}
Prohlídky: ${provedeneProhlidky} | Nových klientů: ${periodClients.length}
Prodané nemovitosti: ${periodSales.map((s) => s.property?.nazev || "neznámá").join(", ") || "žádné"}
`

          interface SlideJSON { titulek: string; podnazev: string; obsah: string[]; takeaway: string }
          let prezentaceSlidy: Array<{ titulek: string; podnazev: string; obsah: string[]; takeaway: string }> = []

          try {
            const { text } = await generateText({
              model: anthropic("claude-haiku-4-5-20251001"),
              system: "Jsi expert na business reporting pro realitní firmy. Odpovídej POUZE validním JSON arrayem, žádný jiný text.",
              prompt: `Na základě těchto dat vytvoř 3 prezentační slidy pro vedení realitní firmy.

${statsContext}

Odpověz POUZE JSON arrayem (přesně 3 položky):
[
  {
    "titulek": "Výsledky ${typ === "tydenni" ? "týdne" : typ === "mesicni" ? "měsíce" : "období"}",
    "podnazev": "konkrétní shrnutí výkonu v 1 větě s čísly",
    "obsah": ["bullet 1 s konkrétním číslem", "bullet 2", "bullet 3", "bullet 4"],
    "takeaway": "1 klíčový insight pro vedení — max 15 slov"
  },
  {
    "titulek": "Pipeline & obchody",
    "podnazev": "stav obchodní pipeline s konkrétními čísly",
    "obsah": ["bullet se stavem pipeline", "bullet o konverzi", "bullet o nejdůležitějším obchodu/klientovi", "bullet o prohlídkách"],
    "takeaway": "hlavní riziko nebo příležitost v pipeline"
  },
  {
    "titulek": "Doporučení a next steps",
    "podnazev": "prioritní akce pro příští ${typ === "tydenni" ? "týden" : typ === "mesicni" ? "měsíc" : "období"}",
    "obsah": ["konkrétní akce 1", "konkrétní akce 2", "konkrétní akce 3", "konkrétní akce 4"],
    "takeaway": "nejdůležitější priorita — max 12 slov"
  }
]`,
              maxOutputTokens: 1500,
            })

            const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim()
            prezentaceSlidy = JSON.parse(cleaned) as Array<SlideJSON>
          } catch {
            // Fallback to static content if AI fails
            prezentaceSlidy = [
              {
                titulek: `Výsledky ${typ === "tydenni" ? "týdne" : "období"}`,
                podnazev: `${periodLeads.length} leadů, ${uzavrenoLeadu} uzavřených obchodů, tržby ${formatCZK(trzba)}`,
                obsah: [
                  `${periodLeads.length} nových leadů (konverzní poměr ${konverzniPomer}%)`,
                  `${uzavrenoLeadu} uzavřených obchodů s tržbami ${formatCZK(trzba)}`,
                  `${provedeneProhlidky} provedených prohlídek`,
                  `${periodClients.length} nových klientů v CRM`,
                ],
                takeaway: uzavrenoLeadu > 0 ? `Uzavřeno ${uzavrenoLeadu} obchodů — cíl plněn` : "Zaměřit se na uzavírání rozpracovaných obchodů",
              },
              {
                titulek: "Pipeline & obchody",
                podnazev: `${periodLeads.length} leadů v pipeline, konverze ${konverzniPomer}%`,
                obsah: Object.entries(statusBreakdown)
                  .map(([k, v]) => `${statusLabels[k] || k}: ${v} leadů`)
                  .slice(0, 4),
                takeaway: statusBreakdown["vyjednavani"] ? `${statusBreakdown["vyjednavani"]} obchodů ve vyjednávání — sledovat` : "Pipeline potřebuje doplnit nové leady",
              },
              {
                titulek: "Doporučení a next steps",
                podnazev: "Prioritní akce pro příští období",
                obsah: [
                  "Follow-up s kontaktovanými klienty do 48 hodin",
                  "Naplánovat prohlídky pro aktivní leady",
                  "Doplnit chybějící data u nemovitostí",
                  "Aktivizovat neaktivní leady před koncem měsíce",
                ],
                takeaway: "Fokus na konverzi stávající pipeline",
              },
            ]
          }

          return {
            nazev: reportNazev,
            obdobi: `${formatDate(dateFrom)} – ${formatDate(dateTo)}`,
            typ,
            klicoveMetriky: {
              novychLeadu: periodLeads.length,
              uzavrenychObchodu: uzavrenoLeadu,
              trzba,
              noveNemovitosti: periodClients.length,
              provedeneProhlidky,
              konverzniPomer,
            },
            prezentaceSlidy,
          }
        },
      },

      readEmails: {
        description:
          "Přečte emaily z Gmailu uživatele. Použij pro ranní briefing, hledání emailů od klientů, nebo když uživatel chce vidět poštu.",
        inputSchema: z.object({
          query: z
            .string()
            .optional()
            .describe("Gmail vyhledávací dotaz, např. 'from:klient@email.cz' nebo 'subject:prohlídka'"),
          limit: z.number().optional().describe("Maximální počet emailů (default 10)"),
          unreadOnly: z.boolean().optional().describe("Jen nepřečtené emaily"),
        }),
        execute: async ({ query, limit, unreadOnly }) => {
          const baseUrl = getBaseUrl()

          try {
            const params = new URLSearchParams()
            if (query) params.set("q", query)
            if (limit) params.set("limit", String(limit))
            if (unreadOnly) params.set("unread", "true")

            const res = await fetch(`${baseUrl}/api/gmail?${params}`, { cache: "no-store" })
            if (!res.ok) {
              const d = await res.json()
              return { error: d.error || "Gmail nedostupný", emails: [] }
            }
            const data = await res.json()
            return {
              emails: (data.emails ?? []).slice(0, limit ?? 10).map((e: {
                id: string; od: string; predmet: string; datum: string; snippet: string; precteno: boolean
              }) => ({
                id: e.id,
                od: e.od,
                predmet: e.predmet,
                datum: e.datum,
                snippet: e.snippet,
                precteno: e.precteno,
              })),
              total: data.total ?? 0,
            }
          } catch (err) {
            return { error: String(err), emails: [] }
          }
        },
      },

      sendGmail: {
        description:
          "Odešle email přes Gmail uživatele. Použij po schválení uživatele, nebo když jasně řekne 'pošli email'.",
        inputSchema: z.object({
          komu: z.string().describe("Emailová adresa příjemce"),
          predmet: z.string().describe("Předmět emailu"),
          telo: z.string().describe("Tělo emailu — hotový text k odeslání"),
        }),
        execute: async ({ komu, predmet, telo }) => {
          const baseUrl = getBaseUrl()

          try {
            const res = await fetch(`${baseUrl}/api/gmail/send`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ to: komu, subject: predmet, body: telo }),
              cache: "no-store",
            })
            if (!res.ok) {
              const d = await res.json()
              return { success: false, error: d.error || "Chyba při odesílání" }
            }
            const d = await res.json()
            return { success: true, id: d.id, message: `Email odeslán na ${komu}` }
          } catch (err) {
            return { success: false, error: String(err) }
          }
        },
      },

      createNote: {
        description:
          "Vytvoří novou poznámku nebo úkol. Použij když uživatel chce zapsat poznámku, přidat úkol, nebo si zapamatovat něco důležitého.",
        inputSchema: z.object({
          titulek: z.string().describe("Název poznámky nebo úkolu"),
          obsah: z.string().optional().describe("Detail nebo popis"),
          priorita: z.enum(["low", "medium", "high"]).optional().describe("Priorita (default medium)"),
          tagy: z.array(z.string()).optional().describe("Štítky, např. ['klient', 'nemovitost']"),
        }),
        execute: async ({ titulek, obsah, priorita, tagy }) => {
          try {
            const note = await prisma.note.create({
              data: { titulek, obsah: obsah ?? "", priorita: priorita ?? "medium", tagy: tagy ?? [] },
            })
            return { success: true, note, message: `Poznámka "${titulek}" vytvořena` }
          } catch (err) {
            return { success: false, error: String(err) }
          }
        },
      },

      getNotes: {
        description:
          "Načte poznámky a úkoly. Použij pro přehled otevřených úkolů, ranní briefing nebo hledání konkrétní poznámky.",
        inputSchema: z.object({
          stav: z.enum(["todo", "in_progress", "done"]).optional().describe("Filtr podle stavu"),
          priorita: z.enum(["low", "medium", "high"]).optional().describe("Filtr podle priority"),
        }),
        execute: async ({ stav, priorita }) => {
          try {
            const where: Record<string, unknown> = {}
            if (stav) where.stav = stav
            if (priorita) where.priorita = priorita
            const arr = await prisma.note.findMany({ where, orderBy: { createdAt: "desc" } })
            return {
              notes: arr,
              total: arr.length,
              todoCount: arr.filter((n) => n.stav === "todo").length,
              inProgressCount: arr.filter((n) => n.stav === "in_progress").length,
              doneCount: arr.filter((n) => n.stav === "done").length,
            }
          } catch (err) {
            return { error: String(err), notes: [] }
          }
        },
      },

      analyzeUpload: {
        description:
          "Analyzuje nahraný soubor (CSV, XLSX, JSON, TXT). Použij když uživatel nahraje soubor a chce z něj získat informace nebo statistiky.",
        inputSchema: z.object({
          fileId: z.string().describe("ID nahraného souboru z /api/upload"),
        }),
        execute: async ({ fileId }) => {
          try {
            const { prisma: db } = await import("@/lib/db")
            const file = await db.uploadedFile.findUnique({ where: { id: fileId } })
            if (!file) return { error: "Soubor nenalezen" }
            return {
              id: file.id,
              nazev: file.nazev,
              typ: file.typ,
              velikost: file.velikost,
              analyza: file.analyza,
              obsahUkázka: file.obsah?.slice(0, 500) ?? null,
            }
          } catch (err) {
            return { error: String(err) }
          }
        },
      },

      searchRealEstate: {
        description:
          "Aktivně prohledá realitní servery (zejména Sreality) a najde nemovitosti podle zadaných kritérií. Použij VŽDY když uživatel chce najít nemovitost na trhu, hledá konkrétní typ nemovitosti, chce porovnat nabídky, nebo říká věci jako 'najdi mi', 'vyhledej', 'co je na trhu', 'podívej se na sreality' atd.",
        inputSchema: z.object({
          lokalita: z.string().optional().describe("Město nebo čtvrť, např. 'Praha', 'Holešovice', 'Brno'"),
          typ: z.enum(["byt", "dum", "pozemek", "komercni"]).optional().describe("Typ nemovitosti"),
          nabidka: z.enum(["prodej", "pronajem"]).optional().describe("Typ nabídky"),
          minCena: z.number().optional().describe("Minimální cena v CZK"),
          maxCena: z.number().optional().describe("Maximální cena v CZK"),
          minPlocha: z.number().optional().describe("Minimální plocha v m²"),
          maxPlocha: z.number().optional().describe("Maximální plocha v m²"),
          dispozice: z.string().optional().describe("Dispozice bytu, např. '2+kk', '3+1'"),
          vlastnosti: z.array(z.string()).optional().describe("Vlastnosti nemovitosti: terasa, balkon, garaz, sklep, vyhled, zahrada, parkovani, novostavba, rekonstrukce, lodzie"),
          razeni: z.enum(["nejlevnejsi", "nejdrazsi", "nejnovejsi", "nejvetsi", "cena_za_m2"]).optional().describe("Řazení výsledků"),
        }),
        execute: async ({ lokalita, typ, nabidka, minCena, maxCena, minPlocha, maxPlocha, dispozice, vlastnosti, razeni }) => {
          const categoryMainMap: Record<string, number> = { byt: 1, dum: 2, pozemek: 3, komercni: 4 }
          const categoryTypeMap: Record<string, number> = { prodej: 1, pronajem: 2 }

          const srealityUrl = new URL("https://www.sreality.cz/api/cs/v2/estates")
          srealityUrl.searchParams.set("category_main_cb", String(categoryMainMap[typ ?? "byt"]))
          srealityUrl.searchParams.set("category_type_cb", String(categoryTypeMap[nabidka ?? "prodej"]))
          srealityUrl.searchParams.set("locality_search", lokalita ?? "Praha")
          srealityUrl.searchParams.set("per_page", "60")
          srealityUrl.searchParams.set("tms", Date.now().toString())

          if (minCena) srealityUrl.searchParams.set("czk_price_summary_order2_from", String(minCena))
          if (maxCena) srealityUrl.searchParams.set("czk_price_summary_order2_to", String(maxCena))
          if (minPlocha || maxPlocha) srealityUrl.searchParams.set("usable_area", `${minPlocha ?? 0}|${maxPlocha ?? 10000}`)
          if (razeni === "nejlevnejsi") srealityUrl.searchParams.set("sort", "0")
          else if (razeni === "nejdrazsi") srealityUrl.searchParams.set("sort", "1")
          else if (razeni === "nejnovejsi") srealityUrl.searchParams.set("sort", "2")

          const UA_STR = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

          const toSlugLocal = (s: string) =>
            s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

          const extractDispositionLocal = (name: string) => {
            const m = name.match(/\b(\d+\+(?:kk|\d+))\b/i)
            return m ? m[1].toLowerCase() : ""
          }

          const extractAreaLocal = (name: string) => {
            const m = name.match(/(\d+)\s*m[²2]/i)
            return m ? parseInt(m[1], 10) : 0
          }

          interface SrEstate {
            name?: string
            price?: number
            locality?: string
            hash_id?: number
            seo?: { locality?: string }
            _links?: { images?: Array<{ href: string }> }
            new?: boolean
            price_czk?: { value_raw?: number }
          }

          try {
            const ctrl = new AbortController()
            const timer = setTimeout(() => ctrl.abort(), 12_000)
            const res = await fetch(srealityUrl.toString(), {
              headers: {
                "User-Agent": UA_STR,
                Accept: "application/json, text/plain, */*",
                "Accept-Language": "cs-CZ,cs;q=0.9",
                Referer: "https://www.sreality.cz/",
                "Cache-Control": "no-cache",
              },
              cache: "no-store",
              signal: ctrl.signal,
            }).finally(() => clearTimeout(timer))

            const json = res.ok ? await res.json() : null
            const estates: SrEstate[] = json?._embedded?.estates ?? []
            const totalCount: number = json?.result_size?.count ?? estates.length
            const now = new Date().toISOString()

            const typNabidky = nabidka ?? "prodej"
            const typNemovitosti = typ ?? "byt"

            const results = estates
              .filter((e) => e.hash_id != null)
              .map((e) => {
                const hashId = e.hash_id!
                const name = e.name ?? ""
                const price = e.price_czk?.value_raw ?? e.price ?? 0
                const dispozice = extractDispositionLocal(name)
                const plocha = extractAreaLocal(name)
                const localityRaw = e.seo?.locality ?? e.locality ?? (lokalita ?? "")
                const localitySlug = toSlugLocal(localityRaw)
                const dispSlug = dispozice || typNemovitosti
                const detailUrl = `https://www.sreality.cz/detail/${typNabidky}/${typNemovitosti}/${dispSlug}/${localitySlug}/${hashId}`
                const rawHref = e._links?.images?.[0]?.href ?? ""
                const obrazek = rawHref && rawHref.startsWith("http") && !rawHref.includes("{") ? rawHref : undefined

                return {
                  id: `sreality-${hashId}`,
                  nazev: name,
                  cena: price,
                  lokalita: localityRaw,
                  url: detailUrl,
                  plocha,
                  dispozice: dispozice || typNemovitosti,
                  datumNalezeni: now,
                  novinka: e.new ?? false,
                  obrazek,
                }
              })
              .filter((r) => r.cena > 1000 && r.cena >= 100_000)
              .filter((r) => {
                if (dispozice && !r.nazev.toLowerCase().includes(dispozice.toLowerCase())) return false
                if (vlastnosti && vlastnosti.length > 0) {
                  const name = r.nazev.toLowerCase()
                  const vlastnostiMap: Record<string, string[]> = {
                    terasa: ["terasa", "terrace"],
                    balkon: ["balkon", "balkón", "balcony"],
                    garaz: ["garáž", "garaz", "garage"],
                    sklep: ["sklep", "cellar"],
                    vyhled: ["výhled", "vyhled", "výhledy"],
                    zahrada: ["zahrada", "garden"],
                    parkovani: ["parkování", "parkovani", "parking", "garážové stání"],
                    novostavba: ["novostavba", "nová stavba", "new build"],
                    rekonstrukce: ["rekonstrukce", "po rekonstrukci", "renovated"],
                    lodzie: ["lodžie", "lodzie", "loggia"],
                  }
                  return vlastnosti.some((v: string) => {
                    const synonyms = vlastnostiMap[v.toLowerCase()] ?? [v.toLowerCase()]
                    return synonyms.some((s: string) => name.includes(s))
                  })
                }
                return true
              })

            // Build search URLs for other servers
            const lokSlug = toSlugLocal(lokalita ?? "Praha")
            const offerTypeBR = nabidka === "pronajem" ? "PRONAJEM" : "PRODEJ"
            const estateTypeBR = typ === "dum" ? "DUM" : typ === "pozemek" ? "POZEMEK" : "BYT"

            const dalsiServery = [
              {
                server: "bezrealitky",
                url: `https://www.bezrealitky.cz/vyhledat?offerType=${offerTypeBR}&estateType=${estateTypeBR}`,
                label: "Hledat na Bezrealitky",
              },
              {
                server: "idnes",
                url: `https://reality.idnes.cz/s/${typNabidky}/byty/${lokSlug}/`,
                label: "Hledat na iDnes Reality",
              },
              {
                server: "bazos",
                url: `https://reality.bazos.cz/prodam/byt/${lokSlug}/`,
                label: "Hledat na Bazoš",
              },
            ]

            if (razeni === "cena_za_m2") {
              results.sort((a, b) => {
                const aM2 = a.plocha > 0 ? a.cena / a.plocha : Infinity
                const bM2 = b.plocha > 0 ? b.cena / b.plocha : Infinity
                return aM2 - bM2
              })
            }

            const ceny = results.map((r) => r.cena).filter(Boolean)
            const cenaPrumer = ceny.length > 0 ? Math.round(ceny.reduce((a, b) => a + b, 0) / ceny.length) : 0
            const cenaMin = ceny.length > 0 ? Math.min(...ceny) : 0
            const cenaMax = ceny.length > 0 ? Math.max(...ceny) : 0

            return {
              results: results.slice(0, 20),
              celkem: totalCount,
              filtry: {
                lokalita: lokalita ?? "Praha",
                typ: typNemovitosti,
                nabidka: typNabidky,
                minCena,
                maxCena,
                minPlocha,
              },
              statistiky: {
                cenaPrumer,
                cenaMin,
                cenaMax,
              },
              dalsiServery,
              srealitySearchUrl: srealityUrl.toString().replace("api/cs/v2/estates", "hledani/prodej/byty").split("?")[0],
            }
          } catch (err) {
            return {
              results: [],
              celkem: 0,
              filtry: { lokalita: lokalita ?? "Praha", typ: typ ?? "byt", nabidka: nabidka ?? "prodej" },
              statistiky: { cenaPrumer: 0, cenaMin: 0, cenaMax: 0 },
              dalsiServery: [],
              error: String(err),
            }
          }
        },
      },

      searchDocuments: {
        description: "Prohledá interní dokumenty firmy (smlouvy, nabídky, reporty, faktury). Použij když uživatel hledá dokument, smlouvu, report nebo fakturu.",
        inputSchema: z.object({
          dotaz: z.string().describe("Co hledá — klíčová slova nebo popis dokumentu"),
          category: z.enum(["smlouva", "nabidka", "report", "faktura", "technicka_zprava", "jiny"]).optional(),
        }),
        execute: async ({ dotaz, category }) => {
          try {
            const where: Record<string, unknown> = {
              OR: [
                { filename: { contains: dotaz, mode: "insensitive" } },
                { content: { contains: dotaz, mode: "insensitive" } },
                { summary: { contains: dotaz, mode: "insensitive" } },
              ],
            }
            if (category) where.category = category
            const documents = await prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, take: 10 })
            return { documents, celkem: documents.length }
          } catch (err) {
            return { documents: [], celkem: 0, error: String(err) }
          }
        },
      },

      readDocument: {
        description: "Přečte obsah konkrétního interního dokumentu. Použij když uživatel chce vědět co je v dokumentu nebo ho chce analyzovat.",
        inputSchema: z.object({
          documentId: z.string().describe("ID dokumentu z výsledků searchDocuments"),
          dotaz: z.string().optional().describe("Konkrétní otázka k dokumentu"),
        }),
        execute: async ({ documentId }) => {
          try {
            const doc = await prisma.document.findUnique({ where: { id: documentId } })
            if (!doc) return { error: "Dokument nenalezen" }
            return {
              filename: doc.filename,
              category: doc.category,
              summary: doc.summary,
              content: doc.content?.slice(0, 4000),
              createdAt: doc.createdAt,
            }
          } catch (err) {
            return { error: String(err) }
          }
        },
      },

      findDiscounts: {
        description: "Najde zlevněné nemovitosti na trhu. Použij když uživatel hledá slevy, výhodné nabídky nebo zlevněné nemovitosti.",
        inputSchema: z.object({
          lokalita: z.string().optional().describe("Lokalita hledání, default Praha"),
          typ: z.enum(["byt", "dum", "pozemek"]).optional().describe("Typ nemovitosti, default byt"),
        }),
        execute: async ({ lokalita, typ }) => {
          const categoryMap: Record<string, number> = { byt: 1, dum: 2, pozemek: 3 }
          const url = new URL("https://www.sreality.cz/api/cs/v2/estates")
          url.searchParams.set("category_main_cb", String(categoryMap[typ ?? "byt"]))
          url.searchParams.set("category_type_cb", "1")
          url.searchParams.set("locality_search", lokalita ?? "Praha")
          url.searchParams.set("per_page", "100")
          url.searchParams.set("tms", Date.now().toString())

          interface SrEstate {
            hash_id?: number
            name?: string
            price_czk?: { value_raw?: number; name?: string }
            seo?: { locality?: string }
            labels?: string[]
            new?: boolean
          }

          try {
            const res = await fetch(url.toString(), {
              headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json", Referer: "https://www.sreality.cz/" },
              signal: AbortSignal.timeout(15_000),
            })
            const json = res.ok ? await res.json() : null
            const estates: SrEstate[] = json?._embedded?.estates ?? []

            const discounted = estates
              .filter((e) => {
                const price = e.price_czk?.value_raw ?? 0
                if (price < 100_000) return false
                const labels = e.labels ?? []
                return labels.some((l: string) => l.toLowerCase().includes("zlevněno") || l.toLowerCase().includes("snížen") || l.toLowerCase().includes("sleva"))
              })
              .map((e) => {
                const hashId = e.hash_id!
                const lokalitaSlug = (e.seo?.locality ?? "").toLowerCase().replace(/\s+/g, "-")
                const typSlug = typ ?? "byt"
                return {
                  id: `sreality-${hashId}`,
                  nazev: e.name ?? "",
                  cena: e.price_czk?.value_raw ?? 0,
                  lokalita: e.seo?.locality ?? "",
                  url: `https://www.sreality.cz/detail/prodej/${typSlug}/byt/${lokalitaSlug}/${hashId}`,
                  jeSleva: true,
                  labels: e.labels ?? [],
                }
              })
              .sort((a, b) => a.cena - b.cena)
              .slice(0, 20)

            return { discounted, celkem: discounted.length, lokalita: lokalita ?? "Praha" }
          } catch (err) {
            return { discounted: [], celkem: 0, error: String(err) }
          }
        },
      },

      getAdvisory: {
        description: "Poskytne AI doporučení ke koupi nebo prodeji nemovitostí. Použij když se uživatel ptá 'co koupit', 'co prodat', 'jaké jsou příležitosti', 'vyplatí se investovat' atd.",
        inputSchema: z.object({
          typ: z.enum(["koupit", "prodat", "analyza"]).describe("Typ doporučení"),
          lokalita: z.string().optional().describe("Lokalita hledání, např. Praha, Holešovice, Brno"),
        }),
        execute: async ({ typ, lokalita }) => {
          try {
            const baseUrl = getBaseUrl()
            // Map free-form locality to known monitoring slugs
            const lokMapping: Record<string, string> = {
              "holešovice": "praha-7-holesovice",
              "holesovice": "praha-7-holesovice",
              "praha 7": "praha-7-holesovice",
              "praha7": "praha-7-holesovice",
              "praha": "praha",
              "brno": "brno",
              "plzeň": "plzen",
              "plzen": "plzen",
            }
            const lokNorm = lokalita
              ? lokalita.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              : ""
            const lokSlug = lokMapping[lokNorm] ?? (lokNorm.includes("bmo") ? "brno" : lokNorm.includes("plze") ? "plzen" : "praha")
            const endpoint = typ === "prodat" ? "/api/ai-advisor/sell" : `/api/ai-advisor/buy?lokalita=${lokSlug}`
            const res = await fetch(`${baseUrl}${endpoint}`, { signal: AbortSignal.timeout(55_000) })
            const data = await res.json()
            if (!res.ok || data.error) {
              return { recommendations: [], error: data.error || `HTTP ${res.status}`, lokalita: lokalita ?? "Praha" }
            }
            return { ...data, lokalita: lokalita ?? "Praha" }
          } catch (err) {
            return { error: String(err), recommendations: [] }
          }
        },
      },

      analyzeMarket: {
        description: "Provede AI analýzu realitního trhu. Použij když uživatel chce vědět jak se vyvíjí trh, jaké jsou ceny, trendy nebo se ptá na investice.",
        inputSchema: z.object({
          lokalita: z.string().optional().describe("Lokalita analýzy, default Praha"),
        }),
        execute: async ({ lokalita }) => {
          try {
            const baseUrl = getBaseUrl()
            const res = await fetch(`${baseUrl}/api/market-analysis?lokalita=${encodeURIComponent(lokalita ?? "Praha")}`, { signal: AbortSignal.timeout(55_000) })
            return await res.json()
          } catch (err) {
            return { error: String(err) }
          }
        },
      },

      getMarketNews: {
        description: "Získá aktuální zprávy a trendy z realitního trhu. Použij když uživatel chce vědět co se děje na trhu nebo se ptá na novinky.",
        inputSchema: z.object({
          lokalita: z.string().optional().describe("Lokalita, default Česko"),
          tema: z.string().optional().describe("Konkrétní téma: hypotéky, legislativa, ceny…"),
        }),
        execute: async ({ lokalita, tema }) => {
          try {
            const baseUrl = getBaseUrl()
            const params = new URLSearchParams({ lokalita: lokalita ?? "Česko" })
            if (tema) params.set("tema", tema)
            const res = await fetch(`${baseUrl}/api/market-news?${params}`, { signal: AbortSignal.timeout(55_000) })
            return await res.json()
          } catch (err) {
            return { error: String(err), news: [] }
          }
        },
      },

      getMonitoring: {
        description:
          "Získá REÁLNÉ výsledky monitoringu nemovitostí. Živá data z Sreality, Bezrealitky, iDnes Reality, RealityMix a Bazoš.",
        inputSchema: z.object({
          lokalita: z
            .string()
            .optional()
            .describe(
              "Lokalita jako volný text, např. 'Holešovice', 'Praha', 'Brno'. Nebo slug: 'praha-7-holesovice', 'praha', 'brno', 'plzen'",
            ),
          dnesOnly: z
            .boolean()
            .optional()
            .describe("Pokud true, vrátí jen dnešní novinky"),
          server: z
            .string()
            .optional()
            .describe(
              "Filtr serveru: sreality, bezrealitky, idnes, realitymix, bazos",
            ),
        }),
        execute: async ({ lokalita, dnesOnly, server }) => {
          const lokMapping: Record<string, string> = {
            "holešovice": "praha-7-holesovice",
            "holesovice": "praha-7-holesovice",
            "praha 7": "praha-7-holesovice",
            "praha7": "praha-7-holesovice",
            "praha-7-holesovice": "praha-7-holesovice",
            "praha": "praha",
            "brno": "brno",
            "plzeň": "plzen",
            "plzen": "plzen",
          }
          const lokNorm = lokalita ? lokalita.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""
          const loc = lokMapping[lokNorm] ?? lokMapping[lokalita?.toLowerCase() ?? ""] ?? "praha-7-holesovice"
          let allResults = [...monitoringResults]
          let serverStatus: Record<string, { live: boolean; count: number }> = {}

          try {
            const liveResults = await fetchMonitoringResults(loc)
            if (liveResults.length > 0) {
              allResults = liveResults
              serverStatus = { sreality: { live: true, count: liveResults.length } }
            }
          } catch {
            // Fallback to mock data
          }

          let filtered = allResults.filter((m) => !m.jeFallback)

          if (dnesOnly) filtered = filtered.filter((m) => m.novinka)
          if (server) {
            filtered = filtered.filter((m) =>
              m.server.toLowerCase().includes(server.toLowerCase()),
            )
          }

          const servery: Record<string, number> = {}
          filtered.forEach((m) => {
            servery[m.server] = (servery[m.server] || 0) + 1
          })

          const prices = filtered.map((m) => m.cena).filter(Boolean)
          const cenaPrumer =
            prices.length > 0
              ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
              : 0

          const liveServers = Object.entries(serverStatus)
            .filter(([, s]) => s.live)
            .map(([name]) => name)
          const failedServers = Object.entries(serverStatus)
            .filter(([, s]) => !s.live)
            .map(([name]) => name)

          return {
            results: filtered.slice(0, 12),
            noveDnes: filtered.filter((m) => m.novinka).length,
            celkem: filtered.length,
            servery,
            cenaPrumer,
            liveServers,
            failedServers,
            note:
              liveServers.length > 0
                ? `Živá data z: ${liveServers.join(", ")}${failedServers.length > 0 ? `. Nedostupné: ${failedServers.join(", ")}` : ""}`
                : "Data jsou z interní databáze (všechny servery nedostupné)",
          }
        },
      },

      // ── CRUD TOOLS ────────────────────────────────────────────────────────────

      createClient: {
        description:
          "Vytvoří nového klienta v CRM systému. Použij když uživatel chce přidat nového klienta, zapsat kontakt, nebo registrovat zájemce.",
        inputSchema: z.object({
          jmeno: z.string().describe("Křestní jméno"),
          prijmeni: z.string().describe("Příjmení"),
          email: z.string().describe("E-mailová adresa"),
          telefon: z.string().describe("Telefonní číslo"),
          typ: z
            .enum(["kupujici", "prodavajici", "najemce", "pronajimatel"])
            .describe("Typ klienta"),
          zdroj: z
            .enum(["sreality", "bezrealitky", "doporuceni", "facebook", "web", "cold-call"])
            .describe("Odkud klient přišel"),
          poznamka: z.string().optional().describe("Volitelná poznámka"),
          prirazenaMakler: z.string().optional().describe("Přiřazený makléř, default Pepa Novák"),
        }),
        execute: async ({ jmeno, prijmeni, email, telefon, typ, zdroj, poznamka, prirazenaMakler }) => {
          const client = await prisma.client.create({
            data: {
              jmeno,
              prijmeni,
              email,
              telefon,
              typ,
              zdroj,
              poznamka: poznamka ?? null,
              prirazenaMakler: prirazenaMakler ?? "Pepa Novák",
              datumPrvnihoKontaktu: new Date(),
              status: "novy",
            },
          })
          return {
            ok: true,
            client: {
              ...client,
              datumPrvnihoKontaktu: client.datumPrvnihoKontaktu.toISOString(),
              createdAt: client.createdAt.toISOString(),
              updatedAt: client.updatedAt.toISOString(),
            },
          }
        },
      },

      updateClient: {
        description:
          "Aktualizuje informace o existujícím klientovi. Použij když uživatel chce změnit údaje klienta, aktualizovat status, přidat poznámku.",
        inputSchema: z.object({
          clientId: z.string().optional().describe("ID klienta pokud je známo"),
          jmeno: z.string().optional().describe("Křestní jméno pro hledání klienta"),
          prijmeni: z.string().optional().describe("Příjmení pro hledání klienta"),
          email: z.string().optional(),
          telefon: z.string().optional(),
          typ: z.string().optional(),
          status: z
            .enum(["novy", "aktivni", "uzavreny", "neaktivni"])
            .optional(),
          poznamka: z.string().optional(),
          prirazenaMakler: z.string().optional(),
        }),
        execute: async ({ clientId, jmeno, prijmeni, ...data }) => {
          let client = null
          if (clientId) {
            client = await prisma.client.findUnique({ where: { id: clientId } })
          } else if (jmeno || prijmeni) {
            const conditions: Record<string, unknown>[] = []
            if (jmeno) conditions.push({ jmeno: { contains: jmeno, mode: "insensitive" } })
            if (prijmeni) conditions.push({ prijmeni: { contains: prijmeni, mode: "insensitive" } })
            client = await prisma.client.findFirst({ where: { AND: conditions } })
          }
          if (!client) return { ok: false, error: "Klient nenalezen" }

          const updateData: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(data)) {
            if (v !== undefined) updateData[k] = v
          }

          const updated = await prisma.client.update({ where: { id: client.id }, data: updateData })
          return {
            ok: true,
            client: {
              ...updated,
              datumPrvnihoKontaktu: updated.datumPrvnihoKontaktu.toISOString(),
              createdAt: updated.createdAt.toISOString(),
              updatedAt: updated.updatedAt.toISOString(),
            },
          }
        },
      },

      createLead: {
        description:
          "Vytvoří nový lead v pipeline. Použij když uživatel chce zaznamenat nový obchodní případ, přiřadit klienta k nemovitosti, nebo vytvořit obchodní příležitost.",
        inputSchema: z.object({
          klientId: z.string().optional().describe("ID klienta pokud je známo"),
          klientJmeno: z.string().optional().describe("Jméno nebo příjmení klienta pro hledání"),
          propertyId: z.string().optional().describe("ID nemovitosti"),
          propertyNazev: z.string().optional().describe("Název nemovitosti pro hledání"),
          hodnotaObchodu: z.number().optional().describe("Odhadovaná hodnota obchodu v Kč"),
          poznamka: z.string().optional(),
          zdroj: z.string().optional().describe("Zdroj leadu, default web"),
        }),
        execute: async ({ klientId, klientJmeno, propertyId, propertyNazev, hodnotaObchodu, poznamka, zdroj }) => {
          let klient = null
          if (klientId) {
            klient = await prisma.client.findUnique({ where: { id: klientId } })
          } else if (klientJmeno) {
            klient = await prisma.client.findFirst({
              where: {
                OR: [
                  { jmeno: { contains: klientJmeno, mode: "insensitive" } },
                  { prijmeni: { contains: klientJmeno, mode: "insensitive" } },
                ],
              },
            })
          }
          if (!klient) return { ok: false, error: "Klient nenalezen" }

          let property = null
          if (propertyId) {
            property = await prisma.property.findUnique({ where: { id: propertyId } })
          } else if (propertyNazev) {
            property = await prisma.property.findFirst({
              where: { nazev: { contains: propertyNazev, mode: "insensitive" } },
            })
          }

          const now = new Date()
          const lead = await prisma.lead.create({
            data: {
              klientId: klient.id,
              propertyId: property?.id ?? null,
              hodnotaObchodu: hodnotaObchodu ?? null,
              poznamka: poznamka ?? null,
              zdroj: zdroj ?? "web",
              status: "novy",
              datumVytvoreni: now,
              datumAktualizace: now,
            },
            include: { klient: true, property: true },
          })
          return {
            ok: true,
            lead: {
              ...lead,
              datumVytvoreni: lead.datumVytvoreni.toISOString(),
              datumAktualizace: lead.datumAktualizace.toISOString(),
              createdAt: lead.createdAt.toISOString(),
              updatedAt: lead.updatedAt.toISOString(),
            },
          }
        },
      },

      updateLead: {
        description:
          "Aktualizuje lead v pipeline — změní status, hodnotu, poznámku. Použij pro přesuny v pipeline a aktualizace obchodních případů.",
        inputSchema: z.object({
          leadId: z.string().optional().describe("ID leadu pokud je známo"),
          klientJmeno: z.string().optional().describe("Jméno klienta pro nalezení aktivního leadu"),
          status: z
            .enum(["novy", "kontaktovan", "prohlidka_domluvena", "nabidka_odeslana", "vyjednavani", "uzavreno", "ztraceno"])
            .optional()
            .describe("Nový status leadu"),
          hodnotaObchodu: z.number().optional(),
          poznamka: z.string().optional(),
        }),
        execute: async ({ leadId, klientJmeno, status, hodnotaObchodu, poznamka }) => {
          let lead = null
          if (leadId) {
            lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { klient: true } })
          } else if (klientJmeno) {
            const klient = await prisma.client.findFirst({
              where: {
                OR: [
                  { jmeno: { contains: klientJmeno, mode: "insensitive" } },
                  { prijmeni: { contains: klientJmeno, mode: "insensitive" } },
                ],
              },
            })
            if (klient) {
              lead = await prisma.lead.findFirst({
                where: {
                  klientId: klient.id,
                  status: { notIn: ["uzavreno", "ztraceno"] },
                },
                orderBy: { datumAktualizace: "desc" },
                include: { klient: true },
              })
            }
          }
          if (!lead) return { ok: false, error: "Lead nenalezen" }

          const prevStatus = lead.status
          const updateData: Record<string, unknown> = { datumAktualizace: new Date() }
          if (status) updateData.status = status
          if (hodnotaObchodu !== undefined) updateData.hodnotaObchodu = hodnotaObchodu
          if (poznamka !== undefined) updateData.poznamka = poznamka

          const updated = await prisma.lead.update({
            where: { id: lead.id },
            data: updateData,
            include: { klient: true, property: true },
          })
          return {
            ok: true,
            prevStatus,
            lead: {
              ...updated,
              datumVytvoreni: updated.datumVytvoreni.toISOString(),
              datumAktualizace: updated.datumAktualizace.toISOString(),
              createdAt: updated.createdAt.toISOString(),
              updatedAt: updated.updatedAt.toISOString(),
            },
          }
        },
      },

      createSale: {
        description:
          "Zaregistruje nový prodej nebo pronájem nemovitosti. Použij když uživatel chce zaznamenat uzavřený obchod.",
        inputSchema: z.object({
          propertyId: z.string().optional().describe("ID nemovitosti"),
          propertyNazev: z.string().optional().describe("Název nemovitosti pro hledání"),
          kupujiciId: z.string().optional().describe("ID kupujícího"),
          kupujiciJmeno: z.string().optional().describe("Jméno kupujícího pro hledání"),
          prodavajiciId: z.string().optional().describe("ID prodávajícího"),
          prodavajiciJmeno: z.string().optional().describe("Jméno prodávajícího pro hledání"),
          cenaFinalni: z.number().describe("Finální cena v Kč"),
          provize: z.number().optional().describe("Výše provize v Kč, default 3 % z ceny"),
          typObchodu: z.enum(["prodej", "pronajem"]).describe("Typ obchodu"),
          datumProdeje: z.string().optional().describe("Datum prodeje ISO, default dnes"),
        }),
        execute: async ({
          propertyId, propertyNazev,
          kupujiciId, kupujiciJmeno,
          prodavajiciId, prodavajiciJmeno,
          cenaFinalni, provize, typObchodu, datumProdeje,
        }) => {
          let property = null
          if (propertyId) {
            property = await prisma.property.findUnique({ where: { id: propertyId } })
          } else if (propertyNazev) {
            property = await prisma.property.findFirst({
              where: { nazev: { contains: propertyNazev, mode: "insensitive" } },
            })
          }
          if (!property) return { ok: false, error: "Nemovitost nenalezena" }

          const findClient = async (id?: string, jmeno?: string) => {
            if (id) return prisma.client.findUnique({ where: { id } })
            if (jmeno) return prisma.client.findFirst({
              where: { OR: [{ jmeno: { contains: jmeno, mode: "insensitive" } }, { prijmeni: { contains: jmeno, mode: "insensitive" } }] },
            })
            return null
          }

          const kupujici = await findClient(kupujiciId, kupujiciJmeno)
          if (!kupujici) return { ok: false, error: "Kupující nenalezen" }

          const prodavajici = await findClient(prodavajiciId, prodavajiciJmeno)
          if (!prodavajici) return { ok: false, error: "Prodávající nenalezen" }

          const finalProvize = provize ?? Math.round(cenaFinalni * 0.03)
          const sale = await prisma.sale.create({
            data: {
              propertyId: property.id,
              klientId: kupujici.id,
              prodavajiciId: prodavajici.id,
              cenaFinalni,
              provize: finalProvize,
              typObchodu,
              datumProdeje: datumProdeje ? new Date(datumProdeje) : new Date(),
            },
            include: { property: true, klient: true, prodavajici: true },
          })

          await prisma.property.update({ where: { id: property.id }, data: { stav: "prodano" } })

          return {
            ok: true,
            sale: {
              ...sale,
              datumProdeje: sale.datumProdeje.toISOString(),
              createdAt: sale.createdAt.toISOString(),
              updatedAt: sale.updatedAt.toISOString(),
            },
          }
        },
      },

      // ── Team tools ─────────────────────────────────────────────────────────

      assignTask: {
        description: "Přiřadí úkol zaměstnanci. Použij když uživatel (šéf) chce přiřadit úkol někomu z týmu, delegovat práci, nebo vytvořit pracovní zadání.",
        inputSchema: z.object({
          komu:       z.string().describe("Jméno zaměstnance, např. 'Jana', 'Martin', 'Jana Dvořáková'"),
          nazev:      z.string().describe("Název úkolu"),
          popis:      z.string().describe("Detailní popis co má zaměstnanec udělat"),
          typ:        z.enum(["obecny","prohlidka","hledani","kontakt","pronajem","prodej","administrativa"]),
          priorita:   z.enum(["low","normal","high","urgent"]).optional().default("normal"),
          termin:     z.string().optional().describe("ISO datum termínu splnění"),
          propertyId: z.string().optional(),
          clientId:   z.string().optional(),
        }),
        execute: async ({ komu, nazev, popis, typ, priorita, termin, propertyId, clientId }) => {
          const assignedTo = await prisma.user.findFirst({
            where: { jmeno: { contains: komu, mode: "insensitive" }, aktivni: true },
          }) ?? await prisma.user.findFirst({
            where: { OR: [{ jmeno: { contains: komu.split(" ")[0], mode: "insensitive" } }, { prijmeni: { contains: komu.split(" ").pop(), mode: "insensitive" } }], aktivni: true },
          })

          if (!assignedTo) return { error: `Zaměstnanec "${komu}" nenalezen` }

          const session = await auth()
          const createdById = (session?.user as Record<string, unknown> | undefined)?.id as string | undefined
            ?? (await prisma.user.findFirst({ where: { role: "admin" } }))?.id
            ?? assignedTo.id

          const task = await prisma.task.create({
            data: {
              title: nazev, description: popis, type: typ,
              priority: priorita ?? "normal",
              assignedToId: assignedTo.id, createdById,
              dueDate: termin ? new Date(termin) : null,
              propertyId: propertyId ?? null,
              clientId: clientId ?? null,
            },
          })

          return {
            success: true,
            task: { ...task, dueDate: task.dueDate?.toISOString() ?? null, createdAt: task.createdAt.toISOString() },
            assignedTo: `${assignedTo.jmeno} ${assignedTo.prijmeni}`,
          }
        },
      },

      getTeamTasks: {
        description: "Zobrazí úkoly týmu nebo konkrétního zaměstnance. Použij když šéf chce vědět na čem kdo pracuje, jaké jsou otevřené úkoly, nebo co je potřeba udělat.",
        inputSchema: z.object({
          zamestnanec: z.string().optional().describe("Jméno pro filtraci, volitelné"),
          status:      z.enum(["novy","rozpracovany","hotovo","vse"]).optional(),
          priorita:    z.enum(["low","normal","high","urgent"]).optional(),
        }),
        execute: async ({ zamestnanec, status, priorita }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const where: Record<string, any> = {}
          if (zamestnanec) {
            const user = await prisma.user.findFirst({
              where: { jmeno: { contains: zamestnanec, mode: "insensitive" } },
            })
            if (user) where.assignedToId = user.id
          }
          if (status && status !== "vse") where.status = status
          if (priorita) where.priority = priorita

          const tasks = await prisma.task.findMany({
            where,
            include: {
              assignedTo: { select: { id: true, jmeno: true, prijmeni: true, pozice: true } },
              createdBy:  { select: { id: true, jmeno: true, prijmeni: true } },
            },
            orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
            take: 30,
          })

          const allTasks = await prisma.task.findMany({ select: { status: true } })
          const stats = { celkem: allTasks.length, novy: 0, rozpracovany: 0, hotovo: 0 }
          for (const t of allTasks) { if (t.status in stats) (stats as Record<string, number>)[t.status]++ }

          return {
            tasks: tasks.map(t => ({ ...t, dueDate: t.dueDate?.toISOString() ?? null, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(), completedAt: t.completedAt?.toISOString() ?? null })),
            stats,
          }
        },
      },
    },
  })

  return result.toUIMessageStreamResponse()
}
