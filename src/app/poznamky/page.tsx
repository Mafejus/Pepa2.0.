"use client"

import { useState, useEffect, useCallback } from "react"
import {
  StickyNote, Plus, Trash2, Check, ChevronRight, X, Loader2,
  AlertTriangle, Flag, Calendar,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Note {
  id: string
  titulek: string
  obsah: string
  stav: "todo" | "in_progress" | "done"
  priorita: "low" | "medium" | "high"
  tagy: string[]
  createdAt: string
  updatedAt: string
}

const STAV_LABELS: Record<Note["stav"], string> = {
  todo: "K udělání",
  in_progress: "Probíhá",
  done: "Hotovo",
}

const STAV_COLORS: Record<Note["stav"], string> = {
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-amber-100 text-amber-700",
  done: "bg-emerald-100 text-emerald-700",
}

const PRIORITA_COLORS: Record<Note["priorita"], string> = {
  low: "text-slate-400",
  medium: "text-amber-500",
  high: "text-red-500",
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function NoteCard({
  note,
  onStatusChange,
  onDelete,
  onEdit,
}: {
  note: Note
  onStatusChange: (id: string, stav: Note["stav"]) => void
  onDelete: (id: string) => void
  onEdit: (note: Note) => void
}) {
  const nextStav: Record<Note["stav"], Note["stav"]> = {
    todo: "in_progress",
    in_progress: "done",
    done: "todo",
  }

  return (
    <div className={cn(
      "bg-white rounded-xl border shadow-sm p-4 group transition-all hover:shadow-md",
      note.stav === "done" ? "border-emerald-200 opacity-75" : "border-slate-200"
    )}>
      <div className="flex items-start gap-2 mb-2">
        <button
          onClick={() => onStatusChange(note.id, nextStav[note.stav])}
          className={cn(
            "flex h-5 w-5 shrink-0 mt-0.5 items-center justify-center rounded-full border-2 transition-colors",
            note.stav === "done"
              ? "border-emerald-400 bg-emerald-400 text-white"
              : "border-slate-300 hover:border-emerald-400"
          )}
        >
          {note.stav === "done" && <Check className="h-3 w-3" />}
        </button>
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "text-[13px] font-semibold text-slate-900 leading-tight",
            note.stav === "done" && "line-through text-slate-400"
          )}>
            {note.titulek}
          </h3>
          {note.obsah && (
            <p className="text-[12px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
              {note.obsah}
            </p>
          )}
        </div>
        <Flag className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", PRIORITA_COLORS[note.priorita])} />
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", STAV_COLORS[note.stav])}>
            {STAV_LABELS[note.stav]}
          </span>
          {note.tagy.slice(0, 3).map((tag) => (
            <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(note)}
            className="p-1 text-slate-400 hover:text-slate-700 rounded"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="p-1 text-slate-400 hover:text-red-500 rounded"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-400">
        <Calendar className="h-3 w-3" />
        {formatDate(note.createdAt)}
      </div>
    </div>
  )
}

function NoteForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Note | null
  onSave: (data: Partial<Note>) => Promise<void>
  onClose: () => void
}) {
  const [titulek, setTitulek] = useState(initial?.titulek ?? "")
  const [obsah, setObsah] = useState(initial?.obsah ?? "")
  const [stav, setStav] = useState<Note["stav"]>(initial?.stav ?? "todo")
  const [priorita, setPriorita] = useState<Note["priorita"]>(initial?.priorita ?? "medium")
  const [tagyStr, setTagyStr] = useState(initial?.tagy.join(", ") ?? "")
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!titulek.trim()) return
    setSaving(true)
    try {
      await onSave({
        titulek: titulek.trim(),
        obsah: obsah.trim(),
        stav,
        priorita,
        tagy: tagyStr.split(",").map((t) => t.trim()).filter(Boolean),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">
            {initial ? "Upravit poznámku" : "Nová poznámka"}
          </h2>
          <button onClick={onClose}><X className="h-4 w-4 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Název</label>
            <input
              value={titulek}
              onChange={(e) => setTitulek(e.target.value)}
              placeholder="Název úkolu nebo poznámky"
              required
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Obsah</label>
            <textarea
              value={obsah}
              onChange={(e) => setObsah(e.target.value)}
              rows={4}
              placeholder="Detail poznámky nebo popis úkolu…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Stav</label>
              <select
                value={stav}
                onChange={(e) => setStav(e.target.value as Note["stav"])}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              >
                {(Object.entries(STAV_LABELS) as [Note["stav"], string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Priorita</label>
              <select
                value={priorita}
                onChange={(e) => setPriorita(e.target.value as Note["priorita"])}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
              >
                <option value="low">Nízká</option>
                <option value="medium">Střední</option>
                <option value="high">Vysoká</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Štítky (oddělené čárkou)</label>
            <input
              value={tagyStr}
              onChange={(e) => setTagyStr(e.target.value)}
              placeholder="klient, nemovitost, follow-up"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
              Zrušit
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Uložit
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PoznamkyPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Note | null>(null)
  const [filterStav, setFilterStav] = useState<Note["stav"] | "all">("all")

  const fetchNotes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/notes")
      const data = await res.json()
      if (Array.isArray(data)) setNotes(data)
    } catch {
      setError("Nepodařilo se načíst poznámky")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  const handleCreate = async (data: Partial<Note>) => {
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const note = await res.json()
    setNotes((prev) => [note, ...prev])
  }

  const handleUpdate = async (data: Partial<Note>) => {
    if (!editing) return
    const res = await fetch(`/api/notes/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    const updated = await res.json()
    setNotes((prev) => prev.map((n) => n.id === editing.id ? updated : n))
    setEditing(null)
  }

  const handleStatusChange = async (id: string, stav: Note["stav"]) => {
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stav }),
    })
    const updated = await res.json()
    setNotes((prev) => prev.map((n) => n.id === id ? updated : n))
  }

  const handleDelete = async (id: string) => {
    await fetch(`/api/notes/${id}`, { method: "DELETE" })
    setNotes((prev) => prev.filter((n) => n.id !== id))
  }

  const filtered = filterStav === "all" ? notes : notes.filter((n) => n.stav === filterStav)

  const columns: Note["stav"][] = ["todo", "in_progress", "done"]

  const counts = {
    all: notes.length,
    todo: notes.filter((n) => n.stav === "todo").length,
    in_progress: notes.filter((n) => n.stav === "in_progress").length,
    done: notes.filter((n) => n.stav === "done").length,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <StickyNote className="h-5 w-5 text-emerald-500" />
            Poznámky & Úkoly
          </h1>
          <p className="text-[12px] text-slate-400 mt-0.5">{notes.length} poznámek celkem</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-[12px] font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
        >
          <Plus className="h-3.5 w-3.5" />
          Přidat
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl border border-slate-200 p-1 w-fit">
        {([["all", "Vše"], ["todo", "K udělání"], ["in_progress", "Probíhá"], ["done", "Hotovo"]] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilterStav(v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
              filterStav === v ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-800"
            )}
          >
            {l}
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded-full",
              filterStav === v ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
            )}>
              {counts[v]}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-48 gap-2 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Načítám…</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-4">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      ) : filterStav === "all" ? (
        /* Kanban view */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {columns.map((col) => (
            <div key={col}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn("text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full", STAV_COLORS[col])}>
                  {STAV_LABELS[col]}
                </span>
                <Badge className="bg-slate-100 text-slate-600 text-[10px]">{counts[col]}</Badge>
              </div>
              <div className="space-y-3">
                {notes.filter((n) => n.stav === col).map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onStatusChange={handleStatusChange}
                    onDelete={handleDelete}
                    onEdit={(n) => { setEditing(n); setFormOpen(true) }}
                  />
                ))}
                {notes.filter((n) => n.stav === col).length === 0 && (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
                    <p className="text-[12px] text-slate-400">Žádné položky</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Filtered list */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onEdit={(n) => { setEditing(n); setFormOpen(true) }}
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16">
              <StickyNote className="h-12 w-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">Žádné poznámky v této kategorii</p>
            </div>
          )}
        </div>
      )}

      {(formOpen || editing) && (
        <NoteForm
          initial={editing}
          onSave={editing ? handleUpdate : handleCreate}
          onClose={() => { setFormOpen(false); setEditing(null) }}
        />
      )}
    </div>
  )
}
