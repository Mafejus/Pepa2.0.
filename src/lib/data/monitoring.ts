export interface MonitoringResult {
  id: string
  server: "sreality" | "bezrealitky" | "idnes" | "realitymix" | "bazos"
  nazev: string
  cena: number
  lokalita: string
  url: string
  plocha: number
  dispozice: string
  datumNalezeni: string
  novinka: boolean
  obrazek?: string
  jeFallback?: boolean
  jeSleva?: boolean
  puvodniCena?: number | null
  slevaProcent?: number | null
}

export const monitoringResults: MonitoringResult[] = [
  {
    id: "m001",
    server: "sreality",
    nazev: "Byt 3+kk, Praha 7 – Holešovice, Dělnická",
    cena: 7650000,
    lokalita: "Praha 7 – Holešovice",
    url: "https://www.sreality.cz/detail/prodej/byt/3+kk/praha-holesovice/99001",
    plocha: 74,
    dispozice: "3+kk",
    datumNalezeni: "2026-03-22T07:12:00Z",
    novinka: true,
  },
  {
    id: "m002",
    server: "bezrealitky",
    nazev: "Byt 2+kk Holešovice — výhled na Vltavu",
    cena: 6200000,
    lokalita: "Praha 7 – Holešovice",
    url: "https://www.bezrealitky.cz/nemovitosti-byty-domy/99002-byt-2kk-holesovice",
    plocha: 58,
    dispozice: "2+kk",
    datumNalezeni: "2026-03-22T07:34:00Z",
    novinka: true,
  },
  {
    id: "m003",
    server: "sreality",
    nazev: "Byt 1+kk, Praha 7 – Letná, Letenské náměstí",
    cena: 4850000,
    lokalita: "Praha 7 – Letná",
    url: "https://www.sreality.cz/detail/prodej/byt/1+kk/praha-letna/99003",
    plocha: 35,
    dispozice: "1+kk",
    datumNalezeni: "2026-03-22T07:55:00Z",
    novinka: true,
  },
  {
    id: "m004",
    server: "idnes",
    nazev: "Byt 3+1, Praha 7 – Holešovice, Komunardů",
    cena: 6900000,
    lokalita: "Praha 7 – Holešovice",
    url: "https://reality.idnes.cz/detail/prodej/byt/3+1/holesovice/99004",
    plocha: 81,
    dispozice: "3+1",
    datumNalezeni: "2026-03-22T07:08:00Z",
    novinka: true,
  },
  {
    id: "m005",
    server: "realitymix",
    nazev: "Novostavba 2+kk Praha 7 – Holešovice",
    cena: 8100000,
    lokalita: "Praha 7 – Holešovice",
    url: "https://www.realitymix.cz/detail/99005-novostavba-2kk-holesovice",
    plocha: 62,
    dispozice: "2+kk",
    datumNalezeni: "2026-03-22T07:22:00Z",
    novinka: true,
  },
  {
    id: "m006",
    server: "sreality",
    nazev: "Byt 4+kk, Praha 7 – Holešovice, Milady Horákové",
    cena: 11200000,
    lokalita: "Praha 7 – Holešovice",
    url: "https://www.sreality.cz/detail/prodej/byt/4+kk/praha-holesovice/99006",
    plocha: 105,
    dispozice: "4+kk",
    datumNalezeni: "2026-03-21T07:18:00Z",
    novinka: false,
  },
  {
    id: "m007",
    server: "bezrealitky",
    nazev: "Byt 3+kk Holešovice — terasa 20m²",
    cena: 9400000,
    lokalita: "Praha 7 – Holešovice",
    url: "https://www.bezrealitky.cz/nemovitosti-byty-domy/99007-byt-3kk-holesovice-terasa",
    plocha: 88,
    dispozice: "3+kk",
    datumNalezeni: "2026-03-21T07:42:00Z",
    novinka: false,
  },
  {
    id: "m008",
    server: "sreality",
    nazev: "Byt 2+1, Praha 7 – Holešovice, Tusarova",
    cena: 5700000,
    lokalita: "Praha 7 – Holešovice",
    url: "https://www.sreality.cz/detail/prodej/byt/2+1/praha-holesovice/99008",
    plocha: 62,
    dispozice: "2+1",
    datumNalezeni: "2026-03-21T07:05:00Z",
    novinka: false,
  },
  {
    id: "m009",
    server: "idnes",
    nazev: "Byt 3+kk, Praha 8 – Libeň (blízko Holešovic)",
    cena: 6450000,
    lokalita: "Praha 8 – Libeň",
    url: "https://reality.idnes.cz/detail/prodej/byt/3+kk/liben/99009",
    plocha: 70,
    dispozice: "3+kk",
    datumNalezeni: "2026-03-21T07:51:00Z",
    novinka: false,
  },
  {
    id: "m010",
    server: "bazos",
    nazev: "Byt 3+kk Praha 7 – Letná — přímý prodej",
    cena: 9800000,
    lokalita: "Praha 7 – Letná",
    url: "https://reality.bazos.cz/inzerat/99010-3kk-letna.htm",
    plocha: 92,
    dispozice: "3+kk",
    datumNalezeni: "2026-03-21T07:28:00Z",
    novinka: false,
  },
]
