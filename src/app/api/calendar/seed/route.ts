import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

function dayOffset(days: number, hour: number, minute = 0): Date {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, minute, 0, 0)
  return d
}

const SEED_EVENTS = [
  { nazev: "Prohlídka bytu 3+kk Holešovice", typ: "prohlidka", zacatek: () => dayOffset(0, 10), konec: () => dayOffset(0, 11), lokace: "Ortenovo náměstí 15, Praha 7", ucastnici: ["Pepa Novák", "Jan Kovář"], poznamka: "Klient preferuje vyšší patro s výhledem" },
  { nazev: "Meeting s klientem Svoboda", typ: "meeting", zacatek: () => dayOffset(0, 14), konec: () => dayOffset(0, 15), lokace: "Kancelář", ucastnici: ["Pepa Novák", "Karel Svoboda"], poznamka: "Diskuze o prodeji domu v Říčanech" },
  { nazev: "Focení bytu Vinohrady", typ: "foceni", zacatek: () => dayOffset(1, 9), konec: () => dayOffset(1, 11), lokace: "Mánesova 42, Praha 2", ucastnici: ["Pepa Novák", "Fotograf studio"], poznamka: "Profesionální fotky pro inzerát" },
  { nazev: "Prohlídka domu Říčany", typ: "prohlidka", zacatek: () => dayOffset(1, 14), konec: () => dayOffset(1, 15, 30), lokace: "Říčany u Prahy", ucastnici: ["Pepa Novák", "Rodina Dvořákových"], poznamka: null },
  { nazev: "Týmový standup", typ: "meeting", zacatek: () => dayOffset(2, 9), konec: () => dayOffset(2, 10), lokace: "Kancelář", ucastnici: ["Pepa Novák", "Jana Dvořáková", "Martin Svoboda"], poznamka: "Týdenní přehled" },
  { nazev: "Administrativa - smlouvy", typ: "administrativa", zacatek: () => dayOffset(2, 13), konec: () => dayOffset(2, 15), lokace: "Kancelář", ucastnici: ["Pepa Novák"], poznamka: "Příprava kupních smluv" },
  { nazev: "Prohlídka bytu 2+kk Karlín", typ: "prohlidka", zacatek: () => dayOffset(3, 10), konec: () => dayOffset(3, 11), lokace: "Sokolovská 80, Praha 8", ucastnici: ["Pepa Novák", "Eva Nováková"], poznamka: null },
  { nazev: "Jednání s developerem", typ: "meeting", zacatek: () => dayOffset(3, 15), konec: () => dayOffset(3, 16, 30), lokace: "Central Park Praha", ucastnici: ["Pepa Novák", "Ing. Horák"], poznamka: "Nabídka spolupráce na projektu" },
  { nazev: "Prohlídka pozemku Černošice", typ: "prohlidka", zacatek: () => dayOffset(4, 10), konec: () => dayOffset(4, 12), lokace: "Černošice", ucastnici: ["Pepa Novák", "Rodina Procházkových"], poznamka: null },
  { nazev: "Oběd s VIP klientem", typ: "meeting", zacatek: () => dayOffset(4, 12, 30), konec: () => dayOffset(4, 14), lokace: "Restaurace La Degustation", ucastnici: ["Pepa Novák", "Ing. Richter"], poznamka: "Potenciální investor — komerční nemovitosti" },
  { nazev: "Předání bytu 4+kk Smíchov", typ: "prohlidka", zacatek: () => dayOffset(5, 9), konec: () => dayOffset(5, 10, 30), lokace: "Plzeňská 120, Praha 5", ucastnici: ["Pepa Novák", "Jan Černý", "Marie Černá"], poznamka: null },
  { nazev: "Příprava prezentace pro vedení", typ: "administrativa", zacatek: () => dayOffset(5, 14), konec: () => dayOffset(5, 16), lokace: "Kancelář", ucastnici: ["Pepa Novák"], poznamka: null },
]

export async function POST() {
  try {
    await prisma.calendarEvent.deleteMany()

    await prisma.calendarEvent.createMany({
      data: SEED_EVENTS.map((e) => ({
        nazev: e.nazev,
        typ: e.typ,
        zacatek: e.zacatek(),
        konec: e.konec(),
        lokace: e.lokace,
        ucastnici: e.ucastnici,
        poznamka: e.poznamka ?? null,
      })),
    })

    return NextResponse.json({ success: true, count: SEED_EVENTS.length })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
