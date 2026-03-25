import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import * as XLSX from "xlsx"

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ["text/csv", "application/json", "text/plain", "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"]

function analyzeText(content: string): Record<string, unknown> {
  const lines = content.split("\n").filter(Boolean)
  const words = content.split(/\s+/).filter(Boolean)
  return {
    radky: lines.length,
    slova: words.length,
    znaky: content.length,
    nahled: content.slice(0, 300),
  }
}

function analyzeCsv(content: string): Record<string, unknown> {
  const lines = content.split("\n").filter(Boolean)
  if (lines.length === 0) return { radky: 0, sloupce: 0 }

  const separator = content.includes(";") ? ";" : ","
  const headers = lines[0].split(separator).map((h) => h.trim().replace(/^"|"$/g, ""))
  const dataRows = lines.slice(1).filter(Boolean)

  // Basic stats per column
  const colStats: Record<string, unknown>[] = headers.map((h, colIdx) => {
    const values = dataRows
      .map((row) => row.split(separator)[colIdx]?.trim().replace(/^"|"$/g, "") ?? "")
      .filter(Boolean)
    const nums = values.map(Number).filter((n) => !isNaN(n))
    return {
      sloupec: h,
      hodnotyCount: values.length,
      ...(nums.length > 0
        ? {
            min: Math.min(...nums),
            max: Math.max(...nums),
            prumer: Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100,
          }
        : {}),
    }
  })

  return {
    radky: dataRows.length,
    sloupce: headers.length,
    hlavicky: headers,
    statistiky: colStats.slice(0, 10),
    nahled: lines.slice(0, 5).join("\n"),
  }
}

function analyzeJson(content: string): Record<string, unknown> {
  const parsed = JSON.parse(content)
  if (Array.isArray(parsed)) {
    const keys = parsed.length > 0 ? Object.keys(parsed[0]) : []
    return {
      typ: "pole",
      delka: parsed.length,
      klice: keys,
      nahled: JSON.stringify(parsed.slice(0, 3), null, 2).slice(0, 500),
    }
  }
  return {
    typ: "objekt",
    klice: Object.keys(parsed),
    nahled: JSON.stringify(parsed, null, 2).slice(0, 500),
  }
}

function analyzeXlsx(buffer: Buffer): Record<string, unknown> {
  const wb = XLSX.read(buffer, { type: "buffer" })
  const sheets: Record<string, unknown>[] = []
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][]
    const headers = json[0] ?? []
    const rows = json.slice(1).filter((r) => r.some(Boolean))
    sheets.push({
      list: sheetName,
      radky: rows.length,
      sloupce: headers.length,
      hlavicky: headers.slice(0, 20),
    })
  }
  return {
    listy: wb.SheetNames,
    pocetListu: wb.SheetNames.length,
    sheets,
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 413 })
    }

    const mimeType = file.type || "text/plain"
    if (!ALLOWED_TYPES.some((t) => mimeType.includes(t.split("/")[1]))) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 415 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "txt"

    let analyza: Record<string, unknown> = {}
    let obsah: string | null = null

    if (ext === "csv") {
      obsah = buffer.toString("utf-8")
      analyza = analyzeCsv(obsah)
    } else if (ext === "json") {
      obsah = buffer.toString("utf-8")
      try {
        analyza = analyzeJson(obsah)
      } catch {
        analyza = analyzeText(obsah)
      }
    } else if (ext === "txt") {
      obsah = buffer.toString("utf-8")
      analyza = analyzeText(obsah)
    } else if (ext === "xlsx" || ext === "xls") {
      analyza = analyzeXlsx(buffer)
    } else if (ext === "pdf") {
      analyza = { typ: "pdf", zprava: "PDF nahráno. Obsah dostupný pro analýzu." }
    }

    const uploaded = await prisma.uploadedFile.create({
      data: {
        nazev: file.name,
        typ: ext,
        obsah: obsah?.slice(0, 50000) ?? null,
        analyza: analyza as object,
        velikost: file.size,
      },
    })

    return NextResponse.json({
      id: uploaded.id,
      nazev: uploaded.nazev,
      typ: uploaded.typ,
      velikost: uploaded.velikost,
      analyza,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
