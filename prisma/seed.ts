/**
 * Prisma seed — imports all mock data and inserts into PostgreSQL.
 * Run: npx prisma db seed
 *
 * Uses original mock IDs as primary keys so FK references work without remapping.
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { hash } from "bcryptjs"

// Load .env.local for DATABASE_URL
try {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch {}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

// ── Import mock data (relative paths — tsx doesn't resolve @/ aliases) ────────
import { clients } from "../src/lib/data/clients"
import { properties } from "../src/lib/data/properties"
import { leads } from "../src/lib/data/leads"
import { sales } from "../src/lib/data/sales"

async function main() {
  console.log("🌱 Seeding database...")

  // ── Clear in reverse FK order (calendar events kept — synced from Google) ──
  console.log("  Clearing existing data...")
  await prisma.sale.deleteMany()
  await prisma.lead.deleteMany()
  await prisma.property.deleteMany()
  await prisma.client.deleteMany()

  // ── Clients ────────────────────────────────────────────────────────────────
  await prisma.client.createMany({
    data: clients.map((c) => ({
      id: c.id, // keep original ID for FK references
      jmeno: c.jmeno,
      prijmeni: c.prijmeni,
      email: c.email,
      telefon: c.telefon,
      typ: c.typ,
      zdroj: c.zdroj,
      datumPrvnihoKontaktu: new Date(c.datumPrvnihoKontaktu),
      status: c.status,
      poznamka: c.poznamka || null,
      prirazenaMakler: c.prirazenaMakler,
    })),
    skipDuplicates: true,
  })
  console.log(`  ✓ ${clients.length} clients`)

  // ── Properties ────────────────────────────────────────────────────────────
  await prisma.property.createMany({
    data: properties.map((p) => ({
      id: p.id,
      nazev: p.nazev,
      typ: p.typ,
      lokalita: p.lokalita,
      cena: p.cena,
      plocha: p.plocha,
      dispozice: p.dispozice,
      stav: p.stav,
      majitel: p.majitel,
      majitelKontakt: p.majitelKontakt,
      rokRekonstrukce: p.rokRekonstrukce ?? null,
      stavebniUpravy: p.stavebniUpravy ?? null,
      energetickaTrida: p.energetickaTrida ?? null,
      fotky: p.fotky,
      popisPopis: p.popisPopis,
      datumNasazeni: new Date(p.datumNasazeni),
      poznamka: p.poznamka ?? null,
    })),
    skipDuplicates: true,
  })
  console.log(`  ✓ ${properties.length} properties`)

  // ── Leads ─────────────────────────────────────────────────────────────────
  await prisma.lead.createMany({
    data: leads.map((l) => ({
      id: l.id,
      klientId: l.klientId,
      propertyId: l.propertyId ?? null,
      status: l.status,
      datumVytvoreni: new Date(l.datumVytvoreni),
      datumAktualizace: new Date(l.datumAktualizace),
      zdroj: l.zdroj,
      hodnotaObchodu: l.hodnotaObchodu ?? null,
      poznamka: l.poznamka || null,
    })),
    skipDuplicates: true,
  })
  console.log(`  ✓ ${leads.length} leads`)

  // ── Sales ─────────────────────────────────────────────────────────────────
  await prisma.sale.createMany({
    data: sales.map((s) => ({
      id: s.id,
      propertyId: s.propertyId,
      klientId: s.klientId,
      prodavajiciId: s.prodavajiciId,
      datumProdeje: new Date(s.datumProdeje),
      cenaFinalni: s.cenaFinalni,
      provize: s.provize,
      typObchodu: s.typObchodu,
    })),
    skipDuplicates: true,
  })
  console.log(`  ✓ ${sales.length} sales`)

  // ── Users + Tasks ──────────────────────────────────────────────────────────
  await prisma.task.deleteMany()
  await prisma.user.deleteMany()

  const adminPassword = await hash("admin123", 12)
  const userPassword  = await hash("heslo123", 12)

  const admin = await prisma.user.create({
    data: {
      id: "user-admin",
      email: "pepa@realitka.cz",
      passwordHash: adminPassword,
      jmeno: "Pepa",
      prijmeni: "Novák",
      role: "admin",
      pozice: "Back Office Manager",
      telefon: "+420 777 111 222",
    },
  })

  const jana = await prisma.user.create({
    data: {
      id: "user-jana",
      email: "jana@realitka.cz",
      passwordHash: userPassword,
      jmeno: "Jana",
      prijmeni: "Dvořáková",
      role: "zamestnanec",
      pozice: "Obchodní makléřka",
      telefon: "+420 777 333 444",
    },
  })

  const martin = await prisma.user.create({
    data: {
      id: "user-martin",
      email: "martin@realitka.cz",
      passwordHash: userPassword,
      jmeno: "Martin",
      prijmeni: "Svoboda",
      role: "zamestnanec",
      pozice: "Obchodní makléř",
      telefon: "+420 777 555 666",
    },
  })

  await prisma.task.createMany({
    data: [
      {
        title: "Domluvit prohlídku bytu 3+kk Holešovice",
        description: "Kontaktovat klienta Nováka a domluvit termín prohlídky bytu na Ortenově náměstí.",
        status: "novy",
        priority: "high",
        type: "prohlidka",
        assignedToId: jana.id,
        createdById: admin.id,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Najít nemovitost v Holešovicích do 6M",
        description: "Prohledat Sreality a Bezrealitky, najít vhodné byty 2+kk nebo 3+kk v Holešovicích do 6 milionů Kč.",
        status: "rozpracovany",
        priority: "normal",
        type: "hledani",
        assignedToId: martin.id,
        createdById: admin.id,
        dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      },
      {
        title: "Zjistit nové potenciální zákazníky",
        description: "Projít nové leady z webu a Facebooku, kontaktovat je a zjistit jejich požadavky.",
        status: "novy",
        priority: "normal",
        type: "kontakt",
        assignedToId: jana.id,
        createdById: admin.id,
      },
      {
        title: "Pronajmout byt na Praze 3",
        description: "Připravit inzerát a najít nájemce pro byt 2+1 na Vinohradech. Cílová cena pronájmu 22 000 Kč/měsíc.",
        status: "novy",
        priority: "high",
        type: "pronajem",
        assignedToId: martin.id,
        createdById: admin.id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    ],
  })
  console.log(`  ✓ 3 users + 4 tasks seeded`)

  // ── Clear Google tokens ────────────────────────────────────────────────────
  await prisma.googleToken.deleteMany()
  console.log("  ✓ Google tokens cleared")

  console.log("\n✅ Seed complete!")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
