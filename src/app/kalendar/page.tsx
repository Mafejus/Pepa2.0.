"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Bot,
  ArrowRight,
  MapPin,
  Users,
  Clock,
  StickyNote,
  Calendar as CalendarIcon,
  RefreshCw,
  CheckCircle2,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

interface CalendarEvent {
  id: string
  nazev: string
  typ: "prohlidka" | "meeting" | "foceni" | "administrativa" | "jine"
  zacatek: string
  konec: string
  lokace: string | null
  ucastnici: string[]
  poznamka: string | null
  propertyId: string | null
  googleEventId: string | null
  source?: "db" | "google"
}

interface EventFormData {
  nazev: string
  typ: CalendarEvent["typ"]
  datum: string
  casOd: string
  casDo: string
  lokace: string
  poznamka: string
  ucastnici: string
}

const EMPTY_FORM: EventFormData = {
  nazev: "",
  typ: "jine",
  datum: "",
  casOd: "09:00",
  casDo: "10:00",
  lokace: "",
  poznamka: "",
  ucastnici: "",
}

// ──────────────────────────────────────────────
// CONFIG
// ──────────────────────────────────────────────

const HOUR_HEIGHT = 64
const START_HOUR = 8
const END_HOUR = 18
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

function getWeekDays(weekOffset: number) {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return {
      date: d,
      label: ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"][i],
      fullDate: `${d.getDate()}.${d.getMonth() + 1}.`,
      isoDate: d.toISOString().slice(0, 10),
    }
  })
}

// ──────────────────────────────────────────────
// EVENT TYPES
// ──────────────────────────────────────────────

const EVENT_CONFIG: Record<
  CalendarEvent["typ"],
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
  prohlidka: { label: "Prohlídka", bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800", dot: "bg-blue-400" },
  meeting: { label: "Meeting", bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-800", dot: "bg-violet-400" },
  foceni: { label: "Focení", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", dot: "bg-amber-400" },
  administrativa: { label: "Administrativa", bg: "bg-slate-100", border: "border-slate-200", text: "text-slate-700", dot: "bg-slate-400" },
  jine: { label: "Jiné", bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", dot: "bg-gray-400" },
}

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function getEventPosition(event: CalendarEvent) {
  const start = new Date(event.zacatek)
  const end = new Date(event.konec)
  const startMins = start.getUTCHours() * 60 + start.getUTCMinutes()
  const endMins = end.getUTCHours() * 60 + end.getUTCMinutes()
  return {
    top: ((startMins - START_HOUR * 60) / 60) * HOUR_HEIGHT,
    height: Math.max(((endMins - startMins) / 60) * HOUR_HEIGHT, 28),
  }
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getUTCHours().toString().padStart(2, "0")}:${d.getUTCMinutes().toString().padStart(2, "0")}`
}

function isSameUTCDay(iso: string, day: Date) {
  const d = new Date(iso)
  return d.getUTCFullYear() === day.getUTCFullYear() && d.getUTCMonth() === day.getUTCMonth() && d.getUTCDate() === day.getUTCDate()
}

function eventToForm(e: CalendarEvent): EventFormData {
  const zacatek = new Date(e.zacatek)
  const konec = new Date(e.konec)
  return {
    nazev: e.nazev,
    typ: e.typ,
    datum: e.zacatek.slice(0, 10),
    casOd: `${zacatek.getUTCHours().toString().padStart(2, "0")}:${zacatek.getUTCMinutes().toString().padStart(2, "0")}`,
    casDo: `${konec.getUTCHours().toString().padStart(2, "0")}:${konec.getUTCMinutes().toString().padStart(2, "0")}`,
    lokace: e.lokace ?? "",
    poznamka: e.poznamka ?? "",
    ucastnici: e.ucastnici.join(", "),
  }
}

// ──────────────────────────────────────────────
// EVENT FORM DIALOG
// ──────────────────────────────────────────────

function EventFormDialog({
  open,
  editingEvent,
  onClose,
  onSaved,
}: {
  open: boolean
  editingEvent: CalendarEvent | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<EventFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(editingEvent ? eventToForm(editingEvent) : { ...EMPTY_FORM, datum: new Date().toISOString().slice(0, 10) })
      setError(null)
    }
  }, [open, editingEvent])

  const set = (key: keyof EventFormData, val: string) =>
    setForm((f) => ({ ...f, [key]: val }))

  const handleSubmit = async () => {
    if (!form.nazev.trim()) { setError("Název je povinný"); return }
    if (!form.datum) { setError("Datum je povinné"); return }
    if (form.casOd >= form.casDo) { setError("Konec musí být po začátku"); return }

    setSaving(true)
    setError(null)

    const body = {
      nazev: form.nazev.trim(),
      typ: form.typ,
      zacatek: `${form.datum}T${form.casOd}:00Z`,
      konec: `${form.datum}T${form.casDo}:00Z`,
      lokace: form.lokace.trim() || null,
      poznamka: form.poznamka.trim() || null,
      ucastnici: form.ucastnici.split(",").map((s) => s.trim()).filter(Boolean),
    }

    try {
      let res: Response
      if (editingEvent) {
        res = await fetch(`/api/calendar/${editingEvent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch("/api/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }
      if (!res.ok) throw new Error(await res.text())
      onSaved()
      onClose()
    } catch (e) {
      setError(`Chyba při ukládání: ${e}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingEvent ? "Upravit událost" : "Nová událost"}</DialogTitle>
          <DialogDescription className="text-[12px]">
            {editingEvent?.googleEventId
              ? "Změny se propíší i do Google Kalendáře"
              : "Událost bude přidána do kalendáře (a do Google Kalendáře pokud je propojen)"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {/* Název */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Název *</label>
            <Input
              value={form.nazev}
              onChange={(e) => set("nazev", e.target.value)}
              placeholder="Prohlídka bytu, Team meeting…"
              className="text-[13px]"
            />
          </div>

          {/* Typ */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Typ</label>
            <Select value={form.typ} onValueChange={(v) => v && set("typ", v)}>
              <SelectTrigger className="text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Datum + čas */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Datum *</label>
              <Input
                type="date"
                value={form.datum}
                onChange={(e) => set("datum", e.target.value)}
                className="text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Od</label>
              <Input
                type="time"
                value={form.casOd}
                onChange={(e) => set("casOd", e.target.value)}
                className="text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Do</label>
              <Input
                type="time"
                value={form.casDo}
                onChange={(e) => set("casDo", e.target.value)}
                className="text-[13px]"
              />
            </div>
          </div>

          {/* Lokace */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Místo</label>
            <Input
              value={form.lokace}
              onChange={(e) => set("lokace", e.target.value)}
              placeholder="Adresa nebo místo konání"
              className="text-[13px]"
            />
          </div>

          {/* Účastníci */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Účastníci (emaily, čárkou)</label>
            <Input
              value={form.ucastnici}
              onChange={(e) => set("ucastnici", e.target.value)}
              placeholder="jan@firma.cz, marie@firma.cz"
              className="text-[13px]"
            />
          </div>

          {/* Poznámka */}
          <div>
            <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Poznámka</label>
            <Textarea
              value={form.poznamka}
              onChange={(e) => set("poznamka", e.target.value)}
              placeholder="Doplňující informace…"
              className="text-[13px] resize-none"
              rows={2}
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-1.5 text-[13px] text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
          >
            {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : null}
            {editingEvent ? "Uložit změny" : "Vytvořit"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ──────────────────────────────────────────────
// EVENT DETAIL DIALOG
// ──────────────────────────────────────────────

function EventDetailDialog({
  event,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent | null
  onClose: () => void
  onEdit: (e: CalendarEvent) => void
  onDelete: (e: CalendarEvent) => void
}) {
  const [deleting, setDeleting] = useState(false)

  if (!event) return null
  const cfg = EVENT_CONFIG[event.typ] ?? EVENT_CONFIG.jine
  const isGoogle = event.source === "google"

  const handleDelete = async () => {
    if (!confirm(`Smazat událost "${event.nazev}"? ${event.googleEventId ? "Bude odstraněna i z Google Kalendáře." : ""}`)) return
    setDeleting(true)
    try {
      // Google-only events aren't in our DB — just close
      if (isGoogle && !event.id.startsWith("c")) {
        onClose()
        return
      }
      await fetch(`/api/calendar/${event.id}`, { method: "DELETE" })
      onDelete(event)
      onClose()
    } catch {
      alert("Nepodařilo se smazat událost")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={!!event} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
            <span className={cn("text-[11px] font-semibold uppercase tracking-wide", cfg.text)}>{cfg.label}</span>
            {isGoogle && (
              <span className="ml-auto inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                Google
              </span>
            )}
            {!isGoogle && (
              <span className="ml-auto inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Pepa
              </span>
            )}
          </div>
          <DialogTitle className="text-[15px] leading-snug">{event.nazev}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5 text-[12px]">
            <Clock className="h-3 w-3" />
            {formatTime(event.zacatek)} – {formatTime(event.konec)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {event.lokace && (
            <div className="flex items-start gap-2 text-[12px] text-slate-600">
              <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <span>{event.lokace}</span>
            </div>
          )}
          {event.ucastnici.length > 0 && (
            <div className="flex items-start gap-2 text-[12px] text-slate-600">
              <Users className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <span>{event.ucastnici.join(", ")}</span>
            </div>
          )}
          {event.poznamka && (
            <div className="flex items-start gap-2 text-[12px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
              <StickyNote className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
              <span className="leading-relaxed">{event.poznamka}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
          >
            {deleting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Smazat
          </button>
          {!isGoogle && (
            <button
              onClick={() => { onClose(); onEdit(event) }}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Upravit
            </button>
          )}
          <Link
            href={`/agent?prompt=${encodeURIComponent(`Řekni mi více o události: ${event.nazev}`)}`}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 text-white text-[12px] font-medium px-3 py-1.5 hover:bg-emerald-600 transition-colors"
          >
            <Bot className="h-3.5 w-3.5" />
            Zeptat se Pepy
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ──────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────

export default function KalendarPage() {
  const [weekIndex, setWeekIndex] = useState(0)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; email: string | null }>({ connected: false, email: null })

  const week = useMemo(() => {
    const days = getWeekDays(weekIndex)
    return {
      label: weekIndex === 0 ? "Tento týden" : "Příští týden",
      days,
      start: days[0].isoDate,
      end: days[6].isoDate,
    }
  }, [weekIndex])

  const fetchEvents = useCallback(async (w: typeof week, silent = false) => {
    if (!silent) setLoading(true)
    else setSyncing(true)
    try {
      const timeMin = new Date(w.start + "T00:00:00Z").toISOString()
      const timeMax = new Date(w.end + "T23:59:59Z").toISOString()
      const res = await fetch(`/api/calendar?timeMin=${timeMin}&timeMax=${timeMax}`, { cache: "no-store" })
      if (res.ok) setEvents(await res.json())
    } catch { /* ignore */ } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [])

  useEffect(() => {
    fetch("/api/auth/google/status").then((r) => r.json()).then(setGoogleStatus).catch(() => {})
  }, [])

  useEffect(() => {
    fetchEvents(week)
  }, [week, fetchEvents])

  const eventsByDay = useMemo(
    () => week.days.map((day) => events.filter((e) => isSameUTCDay(e.zacatek, day.date))),
    [week, events]
  )

  const totalEvents = eventsByDay.flat().length

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleDisconnect = async () => {
    if (!confirm("Opravdu odpojit Google účet? Synchronizace s Google Kalendářem přestane fungovat.")) return
    setDisconnecting(true)
    try {
      await fetch("/api/auth/google/disconnect", { method: "POST" })
      setGoogleStatus({ connected: false, email: null })
      showToast("Google účet odpojen")
    } catch {
      alert("Nepodařilo se odpojit Google účet")
    } finally {
      setDisconnecting(false)
    }
  }

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch("/api/calendar/seed", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        await fetchEvents(week, true)
        showToast(`Demo kalendář naplněn (${data.count} událostí)`)
      }
    } catch {
      alert("Nepodařilo se naplnit demo daty")
    } finally {
      setSeeding(false)
    }
  }

  const openCreate = () => { setEditingEvent(null); setShowForm(true) }
  const openEdit = (e: CalendarEvent) => { setEditingEvent(e); setShowForm(true) }
  const handleSaved = () => fetchEvents(week, true)
  const handleDeleted = (deleted: CalendarEvent) =>
    setEvents((prev) => prev.filter((e) => e.id !== deleted.id))

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-slate-800 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Google Calendar Banner */}
      {!googleStatus.connected ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-4 w-4 text-blue-500 shrink-0" />
            <div>
              <div className="text-[13px] font-semibold text-slate-800">Propojte Google Kalendář</div>
              <div className="text-[11px] text-slate-500">Synchronizujte události s vaším Google účtem</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[12px] font-medium text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              {seeding ? <RefreshCw className="h-3 w-3 animate-spin" /> : "📅"}
              Naplnit demo daty
            </button>
            <a
              href="/api/auth/google"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700 transition-colors"
            >
              Propojit Google
            </a>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="text-[13px] font-semibold text-slate-800">Google Kalendář propojen ✓</span>
            {googleStatus.email && <span className="text-[11px] text-slate-500">{googleStatus.email}</span>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[12px] font-medium text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              {seeding ? <RefreshCw className="h-3 w-3 animate-spin" /> : "📅"}
              Naplnit demo daty
            </button>
            <button
              onClick={() => fetchEvents(week, true)}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[12px] font-medium text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
              Synchronizovat
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {disconnecting ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
              Odpojit
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900 leading-tight">Kalendář</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Týdenní přehled událostí</p>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3">
          {Object.entries(EVENT_CONFIG).map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className={cn("h-2 w-2 rounded-full", cfg.dot)} />
              {cfg.label}
            </div>
          ))}
        </div>

        {/* Week navigation */}
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          {[0, 1].map((i) => (
            <button
              key={i}
              onClick={() => setWeekIndex(i)}
              className={cn(
                "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                weekIndex === i ? "bg-emerald-500 text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              {i === 0 ? "Tento týden" : "Příští týden"}
            </button>
          ))}
        </div>

        {/* Create button */}
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-600 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Nová událost
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-2 text-[12px] text-slate-500">
        <span className="font-medium text-slate-700">{week.days[0].fullDate} – {week.days[6].fullDate}</span>
        <span className="text-slate-300">·</span>
        {loading
          ? <span className="text-slate-400">Načítám...</span>
          : <span>{totalEvents} {totalEvents === 1 ? "událost" : totalEvents < 5 ? "události" : "událostí"}</span>
        }
        {googleStatus.connected && (
          <>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />Google
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 ml-1" />Pepa
            </span>
          </>
        )}
      </div>

      {/* Mobile list */}
      <div className="md:hidden flex flex-col gap-2">
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 text-slate-300 animate-spin" /></div>
        ) : eventsByDay.flat().length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CalendarIcon className="h-8 w-8 text-slate-300 mb-3" />
            <p className="text-[13px] text-slate-400">Žádné události tento týden</p>
            <button onClick={openCreate} className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-600 transition-colors">
              <Plus className="h-3.5 w-3.5" /> Přidat první událost
            </button>
          </div>
        ) : (
          week.days.map((day, dayIdx) => {
            const dayEvs = eventsByDay[dayIdx]
            if (dayEvs.length === 0) return null
            return (
              <div key={day.fullDate}>
                <div className="flex items-center gap-2 px-1 py-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{day.label}</span>
                  <span className="text-[11px] text-slate-400">{day.fullDate}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {dayEvs.map((event) => {
                    const cfg = EVENT_CONFIG[event.typ] ?? EVENT_CONFIG.jine
                    const isGoogle = event.source === "google"
                    return (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEvent(event)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left w-full transition-all hover:brightness-95",
                          isGoogle ? "bg-blue-50 border-blue-200" : cn(cfg.bg, cfg.border)
                        )}
                      >
                        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", isGoogle ? "bg-blue-400" : cfg.dot)} />
                        <div className="flex-1 min-w-0">
                          <div className={cn("text-[13px] font-semibold truncate", isGoogle ? "text-blue-800" : cfg.text)}>{event.nazev}</div>
                          {event.lokace && <div className="text-[11px] text-slate-500 mt-0.5 truncate">{event.lokace}</div>}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isGoogle && <Badge className="text-[9px] px-1 py-0 bg-blue-100 text-blue-700 border-0">G</Badge>}
                          <span className={cn("text-[11px] font-medium", isGoogle ? "text-blue-700" : cfg.text)}>{formatTime(event.zacatek)}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Calendar grid */}
      <div className="hidden md:block rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
          <div className="border-r border-slate-100" />
          {week.days.map((day, i) => (
            <div
              key={day.fullDate}
              className={cn(
                "flex flex-col items-center py-2.5 border-r border-slate-100 last:border-r-0",
                i >= 5 ? "bg-slate-50/50" : ""
              )}
            >
              <span className="text-[11px] text-slate-400 font-medium">{day.label}</span>
              <span className="text-[13px] font-semibold text-slate-700 leading-tight">{day.fullDate}</span>
              {eventsByDay[i].length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {eventsByDay[i].slice(0, 4).map((e) => (
                    <span
                      key={e.id}
                      className={cn("h-1.5 w-1.5 rounded-full", e.source === "google" ? "bg-blue-400" : (EVENT_CONFIG[e.typ] ?? EVENT_CONFIG.jine).dot)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Time grid */}
        {loading ? (
          <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 text-slate-300 animate-spin" /></div>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: `${HOUR_HEIGHT * (END_HOUR - START_HOUR) + 1}px` }}>
            <div className="grid relative" style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}>
              {/* Time labels */}
              <div className="border-r border-slate-100">
                {HOURS.map((h) => (
                  <div key={h} className="border-b border-slate-50 flex items-start justify-end pr-2 pt-1" style={{ height: `${HOUR_HEIGHT}px` }}>
                    <span className="text-[10px] text-slate-300 font-medium tabular-nums">{h}:00</span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {week.days.map((day, dayIdx) => {
                const dayEvents = eventsByDay[dayIdx]
                return (
                  <div
                    key={day.fullDate}
                    className={cn("relative border-r border-slate-100 last:border-r-0", dayIdx >= 5 ? "bg-slate-50/30" : "")}
                    style={{ height: `${HOUR_HEIGHT * (END_HOUR - START_HOUR)}px` }}
                  >
                    {HOURS.map((h) => (
                      <div key={h} className="absolute inset-x-0 border-b border-slate-50" style={{ top: `${(h - START_HOUR) * HOUR_HEIGHT}px` }} />
                    ))}
                    {dayEvents.map((event, evIdx) => {
                      const { top, height } = getEventPosition(event)
                      const cfg = EVENT_CONFIG[event.typ] ?? EVENT_CONFIG.jine
                      const isGoogle = event.source === "google"
                      const overlapping = dayEvents.slice(0, evIdx).some((prev) => {
                        const p = getEventPosition(prev)
                        return top < p.top + p.height && top + height > p.top
                      })
                      return (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={cn(
                            "absolute rounded-md border px-1.5 py-1 text-left cursor-pointer transition-all hover:brightness-95 hover:shadow-sm group",
                            isGoogle ? "bg-blue-50 border-blue-200 text-blue-800" : cn(cfg.bg, cfg.border, cfg.text)
                          )}
                          style={{
                            top: `${top + 1}px`,
                            height: `${height - 2}px`,
                            left: overlapping ? "25%" : "2px",
                            right: "2px",
                            zIndex: overlapping ? 10 : 5,
                          }}
                        >
                          <div className="text-[10px] font-semibold leading-tight truncate">
                            {isGoogle && <span className="mr-0.5 opacity-60">G·</span>}
                            {formatTime(event.zacatek)} {event.nazev}
                          </div>
                          {height > 40 && (
                            <div className="text-[9px] opacity-60 mt-0.5 leading-tight truncate">
                              {formatTime(event.zacatek)} – {formatTime(event.konec)}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <Link
        href="/agent"
        className="group flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 hover:bg-emerald-100 transition-colors"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <Bot className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-slate-800">Naplánovat schůzku přes Pepu</div>
          <div className="text-[11px] text-slate-500">Navrhni termín prohlídky nebo meetingu — Pepa najde volný čas</div>
        </div>
        <ArrowRight className="h-4 w-4 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
      </Link>

      {/* Dialogs */}
      <EventDetailDialog
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onEdit={(e) => openEdit(e)}
        onDelete={handleDeleted}
      />
      <EventFormDialog
        open={showForm}
        editingEvent={editingEvent}
        onClose={() => { setShowForm(false); setEditingEvent(null) }}
        onSaved={handleSaved}
      />
    </div>
  )
}
