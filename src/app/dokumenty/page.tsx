"use client"

import { useState, useEffect, useRef } from "react"
import { FileText, FileSpreadsheet, Upload, Trash2, Search, Filter, ChevronDown, ChevronUp, X, Loader2, Bot } from "lucide-react"
import Link from "next/link"

interface Document {
  id: string
  filename: string
  mimeType: string
  size: number
  summary: string | null
  category: string
  tags: string[]
  propertyId: string | null
  clientId: string | null
  createdAt: string
  updatedAt: string
}

const CATEGORIES = [
  { value: "", label: "Všechny kategorie" },
  { value: "smlouva", label: "Smlouva" },
  { value: "nabidka", label: "Nabídka" },
  { value: "report", label: "Report" },
  { value: "faktura", label: "Faktura" },
  { value: "technicka_zprava", label: "Technická zpráva" },
  { value: "jiny", label: "Jiný" },
]

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  smlouva: { label: "Smlouva", color: "bg-blue-100 text-blue-700" },
  nabidka: { label: "Nabídka", color: "bg-emerald-100 text-emerald-700" },
  report: { label: "Report", color: "bg-purple-100 text-purple-700" },
  faktura: { label: "Faktura", color: "bg-amber-100 text-amber-700" },
  technicka_zprava: { label: "Tech. zpráva", color: "bg-slate-100 text-slate-700" },
  jiny: { label: "Jiný", color: "bg-slate-100 text-slate-500" },
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "long", year: "numeric" })
}

function FileIcon({ mimeType, filename }: { mimeType: string; filename: string }) {
  const ext = filename.toLowerCase().split(".").pop() ?? ""
  if (ext === "xlsx" || ext === "csv" || mimeType.includes("spreadsheet") || mimeType.includes("csv")) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
  }
  return <FileText className="h-5 w-5 text-blue-500" />
}

function UploadDialog({ onClose, onUploaded }: { onClose: () => void; onUploaded: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [tags, setTags] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      if (tags) fd.append("tags", tags)
      const res = await fetch("/api/documents", { method: "POST", body: fd })
      if (!res.ok) throw new Error("Upload selhal")
      onUploaded()
      onClose()
    } catch (e) {
      setError(String(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Nahrát dokument</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${dragging ? "border-emerald-400 bg-emerald-50" : "border-slate-200 hover:border-slate-300"}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mb-2 h-8 w-8 text-slate-300" />
            {file ? (
              <p className="text-sm font-medium text-slate-700">{file.name}</p>
            ) : (
              <>
                <p className="text-sm font-medium text-slate-600">Přetáhni soubor sem nebo klikni</p>
                <p className="mt-1 text-xs text-slate-400">PDF, DOCX, TXT, CSV, XLSX, JSON</p>
              </>
            )}
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.txt,.csv,.xlsx,.json" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Tagy (oddělené čárkou)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="smlouva, Holešovice, 2025"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Zrušit</button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> AI zpracovává…</span>
            ) : "Nahrát"}
          </button>
        </div>
      </div>
    </div>
  )
}

function DocumentCard({ doc, onDelete }: { doc: Document; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const cat = CATEGORY_LABELS[doc.category] ?? CATEGORY_LABELS.jiny

  async function handleDelete() {
    if (!confirm(`Smazat dokument "${doc.filename}"?`)) return
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" })
    onDelete(doc.id)
  }

  const askPrompt = encodeURIComponent(`Přečti a analyzuj dokument "${doc.filename}" (ID: ${doc.id}). Shrň jeho obsah a odpověz na případné dotazy k němu.`)

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 shrink-0">
          <FileIcon mimeType={doc.mimeType} filename={doc.filename} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{doc.filename}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cat.color}`}>{cat.label}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
            <span>{formatSize(doc.size)}</span>
            <span>·</span>
            <span>{formatDate(doc.createdAt)}</span>
          </div>
          {doc.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {doc.tags.map((tag) => (
                <span key={tag} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{tag}</span>
              ))}
            </div>
          )}
          {doc.summary && (
            <div className="mt-2">
              <p className={`text-[12px] text-slate-600 leading-relaxed ${expanded ? "" : "line-clamp-2"}`}>{doc.summary}</p>
              {doc.summary.length > 120 && (
                <button onClick={() => setExpanded(!expanded)} className="mt-0.5 flex items-center gap-0.5 text-[11px] text-emerald-500 hover:text-emerald-600">
                  {expanded ? <><ChevronUp className="h-3 w-3" /> Méně</> : <><ChevronDown className="h-3 w-3" /> Více</>}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 border-t border-slate-100 px-4 py-2.5">
        <Link
          href={`/agent?prompt=${askPrompt}`}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-emerald-600 hover:bg-emerald-50 transition-colors"
        >
          <Bot className="h-3.5 w-3.5" />
          Zeptej se Pepy
        </Link>
        <div className="h-4 w-px bg-slate-100" />
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Smazat
        </button>
      </div>
    </div>
  )
}

export default function DokumentyPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("")
  const [showUpload, setShowUpload] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (category) params.set("category", category)
      const res = await fetch(`/api/documents?${params}`)
      const data = await res.json()
      setDocuments(data.documents ?? [])
    } catch {
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [search, category])

  function handleDelete(id: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== id))
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dokumenty</h1>
            <p className="mt-0.5 text-sm text-slate-500">Nahrané smlouvy, reporty, nabídky a další soubory</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 transition-colors"
          >
            <Upload className="h-4 w-4" />
            Nahrát dokument
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hledat v dokumentech…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-4 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="text-sm text-slate-700 focus:outline-none bg-transparent"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Stats */}
        {!loading && (
          <p className="text-sm text-slate-500">
            {documents.length} {documents.length === 1 ? "dokument" : documents.length < 5 ? "dokumenty" : "dokumentů"}
          </p>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Načítám dokumenty…</p>
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-white py-20 text-center">
            <FileText className="mb-3 h-10 w-10 text-slate-200" />
            <p className="text-sm font-medium text-slate-500">Žádné dokumenty</p>
            <p className="mt-1 text-xs text-slate-400">Nahrajte první dokument kliknutím na tlačítko výše</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} doc={doc} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadDialog
          onClose={() => setShowUpload(false)}
          onUploaded={load}
        />
      )}
    </div>
  )
}
