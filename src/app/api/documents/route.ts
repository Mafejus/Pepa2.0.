import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { prisma } from "@/lib/db"

// Suppress pdf-parse's zlib.bytesRead deprecation warning (harmless, Node.js internal API rename)
process.on("warning", (warning) => {
  if (warning.name === "DeprecationWarning" && warning.message.includes("zlib.bytesRead")) return
})

export const maxDuration = 60

function detectCategory(content: string, filename: string): string {
  const text = (content + " " + filename).toLowerCase()
  if (text.includes("smlouv") || text.includes("contract")) return "smlouva"
  if (text.includes("faktur") || text.includes("invoice")) return "faktura"
  if (text.includes("nabídka") || text.includes("nabidka") || text.includes("offer")) return "nabidka"
  if (text.includes("report") || text.includes("zpráva") || text.includes("zprava")) return "report"
  if (text.includes("technick") || text.includes("technical") || text.includes("projekt")) return "technicka_zprava"
  return "jiny"
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get("category")
  const propertyId = searchParams.get("propertyId")
  const search = searchParams.get("search")

  const where: Record<string, unknown> = {}
  if (category) where.category = category
  if (propertyId) where.propertyId = propertyId
  if (search) {
    where.OR = [
      { filename: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
    ]
  }

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      size: true,
      summary: true,
      category: true,
      tags: true,
      propertyId: true,
      clientId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ documents })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const propertyId = formData.get("propertyId") as string | null
    const clientId = formData.get("clientId") as string | null
    const tagsRaw = formData.get("tags") as string | null

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

    const filename = file.name
    const mimeType = file.type
    const size = file.size
    const buffer = Buffer.from(await file.arrayBuffer())
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : []

    let content = ""

    // Extract text by file type
    const ext = filename.toLowerCase().split(".").pop() ?? ""

    if (ext === "txt" || ext === "json") {
      content = buffer.toString("utf-8")
    } else if (ext === "pdf") {
      try {
        const pdfParseMod = await import("pdf-parse")
        const pdfParse = (pdfParseMod as unknown as { default: (buf: Buffer) => Promise<{ text: string }> }).default ?? pdfParseMod
        const data = await (pdfParse as (buf: Buffer) => Promise<{ text: string }>)(buffer)
        content = data.text
      } catch {
        content = "[PDF text extraction failed]"
      }
    } else if (ext === "docx") {
      try {
        const mammoth = await import("mammoth")
        const result = await mammoth.extractRawText({ buffer })
        content = result.value
      } catch {
        content = "[DOCX text extraction failed]"
      }
    } else if (ext === "csv") {
      content = buffer.toString("utf-8")
    } else if (ext === "xlsx") {
      try {
        const XLSX = await import("xlsx")
        const wb = XLSX.read(buffer, { type: "buffer" })
        const lines: string[] = []
        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName]
          lines.push(`=== ${sheetName} ===`)
          lines.push(XLSX.utils.sheet_to_csv(ws))
        }
        content = lines.join("\n")
      } catch {
        content = "[XLSX text extraction failed]"
      }
    } else {
      content = buffer.toString("utf-8").slice(0, 10000)
    }

    const category = detectCategory(content, filename)

    // Generate AI summary
    let summary: string | null = null
    try {
      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-6"),
        system: "Jsi asistent realitní kanceláře. Shrň obsah dokumentu stručně v 2-3 větách česky. Vyzdvihni nejdůležitější informace (ceny, strany smlouvy, termíny, nemovitosti). Odpověz POUZE shrnutím, bez uvozovek.",
        prompt: `Dokument: ${filename}\n\nObsah:\n${content.slice(0, 3000)}`,
        maxOutputTokens: 300,
      })
      summary = text.trim()
    } catch {
      summary = null
    }

    const doc = await prisma.document.create({
      data: {
        filename,
        mimeType,
        size,
        content: content.slice(0, 100000),
        summary,
        category,
        tags,
        propertyId: propertyId || null,
        clientId: clientId || null,
      },
    })

    return NextResponse.json({ id: doc.id, filename: doc.filename, summary: doc.summary, category: doc.category })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
