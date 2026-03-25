"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Pencil,
  Trash2,
  Plus,
  ChevronUp,
  ChevronDown,
  Users,
  TrendingUp,
  DollarSign,
  Target,
  Bot,
  ArrowLeft,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────
// TYPY
// ──────────────────────────────────────────────

type Client = {
  id: string
  jmeno: string
  prijmeni: string
  email: string
  telefon: string
  typ: string
  zdroj: string
  datumPrvnihoKontaktu: string
  status: string
  poznamka: string | null
  prirazenaMakler: string
  leads?: Lead[]
  purchasedSales?: Sale[]
}

type Lead = {
  id: string
  klientId: string
  propertyId: string | null
  status: string
  datumVytvoreni: string
  datumAktualizace: string
  zdroj: string
  hodnotaObchodu: number | null
  poznamka: string | null
  klient?: Client
  property?: { id: string; nazev: string; lokalita: string; cena: number }
}

type Sale = {
  id: string
  propertyId: string
  klientId: string
  prodavajiciId: string
  datumProdeje: string
  cenaFinalni: number
  provize: number
  typObchodu: string
  property?: { nazev: string }
  klient?: Client
  prodavajici?: Client
}

// ──────────────────────────────────────────────
// KONSTANTY
// ──────────────────────────────────────────────

const LEAD_STATUSES = [
  { id: "novy", label: "Nový", color: "bg-emerald-500/20 text-emerald-700 border-emerald-300" },
  { id: "kontaktovan", label: "Kontaktován", color: "bg-blue-500/20 text-blue-700 border-blue-300" },
  { id: "prohlidka_domluvena", label: "Prohlídka", color: "bg-amber-500/20 text-amber-700 border-amber-300" },
  { id: "nabidka_odeslana", label: "Nabídka odeslána", color: "bg-purple-500/20 text-purple-700 border-purple-300" },
  { id: "vyjednavani", label: "Vyjednávání", color: "bg-orange-500/20 text-orange-700 border-orange-300" },
  { id: "uzavreno", label: "Uzavřeno", color: "bg-green-500/20 text-green-700 border-green-300" },
  { id: "ztraceno", label: "Ztraceno", color: "bg-red-500/20 text-red-700 border-red-300" },
]

const PIPELINE_BORDER: Record<string, string> = {
  novy: "border-t-emerald-400",
  kontaktovan: "border-t-blue-400",
  prohlidka_domluvena: "border-t-amber-400",
  nabidka_odeslana: "border-t-purple-400",
  vyjednavani: "border-t-orange-400",
  uzavreno: "border-t-green-500",
  ztraceno: "border-t-red-400",
}

// ──────────────────────────────────────────────
// POMOCNÉ FUNKCE
// ──────────────────────────────────────────────

function formatPrice(n: number): string {
  if (n >= 1_000_000) {
    const val = n / 1_000_000
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} mil. Kč`
  }
  return `${n.toLocaleString("cs-CZ")} Kč`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ")
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 60) return `před ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `před ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  return `před ${diffD} dny`
}

// ──────────────────────────────────────────────
// CLIENT FORM
// ──────────────────────────────────────────────

type ClientFormData = {
  jmeno: string
  prijmeni: string
  email: string
  telefon: string
  typ: string
  zdroj: string
  prirazenaMakler: string
  poznamka: string
}

function ClientForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: Client | null
  onSave: (data: ClientFormData) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<ClientFormData>({
    jmeno: initial?.jmeno ?? "",
    prijmeni: initial?.prijmeni ?? "",
    email: initial?.email ?? "",
    telefon: initial?.telefon ?? "",
    typ: initial?.typ ?? "kupujici",
    zdroj: initial?.zdroj ?? "sreality",
    prirazenaMakler: initial?.prirazenaMakler ?? "Pepa Novák",
    poznamka: initial?.poznamka ?? "",
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  function field(key: keyof ClientFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    const errs: string[] = []
    if (!form.jmeno.trim()) errs.push("Jméno je povinné")
    if (!form.prijmeni.trim()) errs.push("Příjmení je povinné")
    if (!form.email.trim()) errs.push("Email je povinný")
    if (!form.telefon.trim()) errs.push("Telefon je povinný")
    if (errs.length > 0) { setErrors(errs); return }
    setErrors([])
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* Jméno + příjmení */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-700">Jméno *</label>
          <Input
            value={form.jmeno}
            onChange={(e) => field("jmeno", e.target.value)}
            placeholder="Jan"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-700">Příjmení *</label>
          <Input
            value={form.prijmeni}
            onChange={(e) => field("prijmeni", e.target.value)}
            placeholder="Novák"
          />
        </div>
      </div>

      {/* Email + telefon */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-700">Email *</label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => field("email", e.target.value)}
            placeholder="jan@email.cz"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-700">Telefon *</label>
          <Input
            value={form.telefon}
            onChange={(e) => field("telefon", e.target.value)}
            placeholder="+420 000 000 000"
          />
        </div>
      </div>

      {/* Typ */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-700">Typ klienta *</label>
        <Select value={form.typ} onValueChange={(v) => field("typ", v ?? "kupujici")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="kupujici">Kupující</SelectItem>
            <SelectItem value="prodavajici">Prodávající</SelectItem>
            <SelectItem value="najemce">Nájemce</SelectItem>
            <SelectItem value="pronajimatel">Pronajímatel</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Zdroj */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-700">Zdroj *</label>
        <Select value={form.zdroj} onValueChange={(v) => field("zdroj", v ?? "web")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sreality">Sreality</SelectItem>
            <SelectItem value="bezrealitky">Bezrealitky</SelectItem>
            <SelectItem value="doporuceni">Doporučení</SelectItem>
            <SelectItem value="facebook">Facebook</SelectItem>
            <SelectItem value="web">Web</SelectItem>
            <SelectItem value="cold-call">Cold call</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Makléř */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-700">Přiřazený makléř *</label>
        <Select value={form.prirazenaMakler} onValueChange={(v) => field("prirazenaMakler", v ?? "Pepa Novák")}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Pepa Novák">Pepa Novák</SelectItem>
            <SelectItem value="Jana Dvořáková">Jana Dvořáková</SelectItem>
            <SelectItem value="Martin Svoboda">Martin Svoboda</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Poznámka */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-700">Poznámka</label>
        <Textarea
          value={form.poznamka}
          onChange={(e) => field("poznamka", e.target.value)}
          placeholder="Volitelná poznámka..."
          rows={3}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Zrušit
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0">
          {saving ? "Ukládám..." : "Uložit"}
        </Button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// ADD LEAD FORM
// ──────────────────────────────────────────────

type LeadFormData = {
  klientId: string
  propertyId: string
  hodnotaObchodu: string
  zdroj: string
  poznamka: string
}

function LeadForm({
  clients,
  properties,
  onSave,
  onCancel,
}: {
  clients: Client[]
  properties: { id: string; nazev: string }[]
  onSave: (data: LeadFormData) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<LeadFormData>({
    klientId: "",
    propertyId: "",
    hodnotaObchodu: "",
    zdroj: "",
    poznamka: "",
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  function field(key: keyof LeadFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    const errs: string[] = []
    if (!form.klientId) errs.push("Vyberte klienta")
    if (!form.zdroj.trim()) errs.push("Zdroj je povinný")
    if (errs.length > 0) { setErrors(errs); return }
    setErrors([])
    setSaving(true)
    try {
      await onSave(form)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-700">Klient *</label>
        <Select value={form.klientId} onValueChange={(v) => field("klientId", v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Vyberte klienta" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.jmeno} {c.prijmeni}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-700">Nemovitost (volitelné)</label>
        <Select value={form.propertyId} onValueChange={(v) => field("propertyId", v ?? "")}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Vyberte nemovitost" />
          </SelectTrigger>
          <SelectContent>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nazev}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-700">Hodnota obchodu (Kč)</label>
        <Input
          type="number"
          value={form.hodnotaObchodu}
          onChange={(e) => field("hodnotaObchodu", e.target.value)}
          placeholder="5000000"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-700">Zdroj *</label>
        <Input
          value={form.zdroj}
          onChange={(e) => field("zdroj", e.target.value)}
          placeholder="sreality, facebook..."
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-700">Poznámka</label>
        <Textarea
          value={form.poznamka}
          onChange={(e) => field("poznamka", e.target.value)}
          placeholder="Volitelná poznámka..."
          rows={3}
        />
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={onCancel} className="flex-1">
          Zrušit
        </Button>
        <Button onClick={handleSubmit} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0">
          {saving ? "Ukládám..." : "Přidat lead"}
        </Button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// LEAD CARD
// ──────────────────────────────────────────────

function LeadCard({
  lead,
  onStatusChange,
}: {
  lead: Lead
  onStatusChange: (id: string, status: string) => void
}) {
  return (
    <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
      <div className="font-semibold text-sm text-slate-900">
        {lead.klient?.jmeno} {lead.klient?.prijmeni}
      </div>
      {lead.property && (
        <div className="text-xs text-slate-500 truncate mt-0.5">{lead.property.nazev}</div>
      )}
      {lead.hodnotaObchodu != null && (
        <div className="font-bold text-sm text-emerald-700 mt-1">
          {formatPrice(lead.hodnotaObchodu)}
        </div>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-slate-400">{relativeTime(lead.datumAktualizace)}</span>
        <span className="text-[10px] rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">
          {lead.zdroj}
        </span>
      </div>
      {lead.poznamka && (
        <div className="mt-1.5 text-[11px] text-slate-500 truncate">{lead.poznamka}</div>
      )}
      <select
        value={lead.status}
        onChange={(e) => onStatusChange(lead.id, e.target.value)}
        className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
      >
        {LEAD_STATUSES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ──────────────────────────────────────────────
// HLAVNÍ STRÁNKA
// ──────────────────────────────────────────────

export default function KlientiPage() {
  // ── Klienti state ──
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typFilter, setTypFilter] = useState("vse")
  const [statusFilter, setStatusFilter] = useState("vse")
  const [zdrojFilter, setZdrojFilter] = useState("vse")
  const [sortKey, setSortKey] = useState<"jmeno" | "email" | "datumPrvnihoKontaktu" | "status">("datumPrvnihoKontaktu")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 15

  const [detailClient, setDetailClient] = useState<Client | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Client | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // ── Leady state ──
  const [leads, setLeads] = useState<Lead[]>([])
  const [leadsLoading, setLeadsLoading] = useState(true)
  const [showLeadDialog, setShowLeadDialog] = useState(false)
  const [properties, setProperties] = useState<{ id: string; nazev: string }[]>([])

  // ── Obecné error state ──
  const [globalError, setGlobalError] = useState<string | null>(null)

  // ────────────────────────────────────────────
  // NAČÍTÁNÍ DAT
  // ────────────────────────────────────────────

  const loadClients = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/clients")
      const data = await res.json()
      setClients(Array.isArray(data) ? data : [])
    } catch {
      setGlobalError("Nepodařilo se načíst klienty.")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadLeads = useCallback(async () => {
    setLeadsLoading(true)
    try {
      const res = await fetch("/api/leads")
      const data = await res.json()
      setLeads(Array.isArray(data) ? data : [])
    } catch {
      setGlobalError("Nepodařilo se načíst leady.")
    } finally {
      setLeadsLoading(false)
    }
  }, [])

  const loadProperties = useCallback(async () => {
    try {
      const res = await fetch("/api/properties")
      const data = await res.json()
      setProperties(
        Array.isArray(data)
          ? data.map((p: { id: string; nazev: string }) => ({ id: p.id, nazev: p.nazev }))
          : []
      )
    } catch {
      // nezobrazovat error pro nemovitosti
    }
  }, [])

  useEffect(() => {
    loadClients()
    loadLeads()
    loadProperties()
  }, [loadClients, loadLeads, loadProperties])

  // ────────────────────────────────────────────
  // DETAIL KLIENTA
  // ────────────────────────────────────────────

  async function loadClientDetail(id: string) {
    try {
      const res = await fetch(`/api/clients/${id}`)
      const data = await res.json()
      setDetailClient(data)
    } catch {
      setGlobalError("Nepodařilo se načíst detail klienta.")
    }
  }

  // ────────────────────────────────────────────
  // FILTROVÁNÍ A ŘAZENÍ
  // ────────────────────────────────────────────

  const filtered = useMemo(() => {
    let arr = clients

    if (search) {
      const q = search.toLowerCase()
      arr = arr.filter(
        (c) =>
          c.jmeno.toLowerCase().includes(q) ||
          c.prijmeni.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.telefon.includes(q)
      )
    }

    if (typFilter !== "vse") arr = arr.filter((c) => c.typ === typFilter)
    if (statusFilter !== "vse") arr = arr.filter((c) => c.status === statusFilter)
    if (zdrojFilter !== "vse") arr = arr.filter((c) => c.zdroj === zdrojFilter)

    arr = [...arr].sort((a, b) => {
      let aVal: string = a[sortKey] ?? ""
      let bVal: string = b[sortKey] ?? ""
      const cmp = aVal.localeCompare(bVal, "cs")
      return sortDir === "asc" ? cmp : -cmp
    })

    return arr
  }, [clients, search, typFilter, statusFilter, zdrojFilter, sortKey, sortDir])

  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  )
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
    setPage(1)
  }

  // ────────────────────────────────────────────
  // LEAD STATUS CHANGE (optimistic)
  // ────────────────────────────────────────────

  async function handleLeadStatusChange(leadId: string, newStatus: string) {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    )
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, datumAktualizace: new Date().toISOString() }),
      })
    } catch {
      loadLeads()
    }
  }

  // ────────────────────────────────────────────
  // PIPELINE STATISTIKY
  // ────────────────────────────────────────────

  const pipelineStats = useMemo(() => {
    const aktivni = leads.filter((l) => !["uzavreno", "ztraceno"].includes(l.status))
    const celkemHodnota = aktivni.reduce((s, l) => s + (l.hodnotaObchodu ?? 0), 0)
    const uzavreno = leads.filter((l) => l.status === "uzavreno").length
    const conversionRate = leads.length > 0 ? Math.round((uzavreno / leads.length) * 100) : 0
    return { celkemAktivni: aktivni.length, celkemHodnota, conversionRate }
  }, [leads])

  // ────────────────────────────────────────────
  // BADGE HELPERY
  // ────────────────────────────────────────────

  function typBadgeClass(typ: string) {
    switch (typ) {
      case "kupujici": return "bg-blue-100 text-blue-700 border-blue-200"
      case "prodavajici": return "bg-green-100 text-green-700 border-green-200"
      case "najemce": return "bg-amber-100 text-amber-700 border-amber-200"
      case "pronajimatel": return "bg-purple-100 text-purple-700 border-purple-200"
      default: return "bg-slate-100 text-slate-600 border-slate-200"
    }
  }

  function typBadgeLabel(typ: string) {
    switch (typ) {
      case "kupujici": return "Kupující"
      case "prodavajici": return "Prodávající"
      case "najemce": return "Nájemce"
      case "pronajimatel": return "Pronajímatel"
      default: return typ
    }
  }

  function statusBadgeClass(status: string) {
    switch (status) {
      case "novy": return "bg-emerald-100 text-emerald-700 border-emerald-200"
      case "aktivni": return "bg-blue-100 text-blue-700 border-blue-200"
      case "uzavreny": return "bg-slate-100 text-slate-600 border-slate-200"
      case "neaktivni": return "bg-red-100 text-red-600 border-red-200"
      default: return "bg-slate-100 text-slate-600 border-slate-200"
    }
  }

  function statusBadgeLabel(status: string) {
    switch (status) {
      case "novy": return "Nový"
      case "aktivni": return "Aktivní"
      case "uzavreny": return "Uzavřený"
      case "neaktivni": return "Neaktivní"
      default: return status
    }
  }

  // ────────────────────────────────────────────
  // SORT IKONA
  // ────────────────────────────────────────────

  function SortIcon({ col }: { col: typeof sortKey }) {
    if (sortKey !== col) return <ChevronDown className="h-3 w-3 opacity-30" />
    return sortDir === "asc" ? (
      <ChevronUp className="h-3 w-3 text-emerald-600" />
    ) : (
      <ChevronDown className="h-3 w-3 text-emerald-600" />
    )
  }

  // ────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      {globalError && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {globalError}
          <button
            onClick={() => setGlobalError(null)}
            className="ml-2 underline text-red-600 hover:text-red-800"
          >
            Zavřít
          </button>
        </div>
      )}

      <Tabs defaultValue="klienti">
        <TabsList className="mb-4">
          <TabsTrigger value="klienti">
            <Users className="h-4 w-4 mr-1.5" />
            Klienti
          </TabsTrigger>
          <TabsTrigger value="pipeline">
            <TrendingUp className="h-4 w-4 mr-1.5" />
            Pipeline
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════
            TAB 1: KLIENTI
        ══════════════════════════════════════════ */}
        <TabsContent value="klienti">
          {/* Horní lišta */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Klienti
              <Badge variant="secondary" className="text-xs font-semibold">
                {clients.length}
              </Badge>
            </h1>
            <Button
              onClick={() => { setEditingClient(null); setShowAddDialog(true) }}
              className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Přidat klienta
            </Button>
          </div>

          {/* Filtry */}
          <div className="flex flex-wrap gap-2 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Hledat jméno, email, telefon..."
                className="pl-3"
              />
            </div>

            <Select value={typFilter} onValueChange={(v) => { setTypFilter(v ?? "vse"); setPage(1) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vse">Všechny typy</SelectItem>
                <SelectItem value="kupujici">Kupující</SelectItem>
                <SelectItem value="prodavajici">Prodávající</SelectItem>
                <SelectItem value="najemce">Nájemce</SelectItem>
                <SelectItem value="pronajimatel">Pronajímatel</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v ?? "vse"); setPage(1) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vse">Všechny statusy</SelectItem>
                <SelectItem value="novy">Nový</SelectItem>
                <SelectItem value="aktivni">Aktivní</SelectItem>
                <SelectItem value="uzavreny">Uzavřený</SelectItem>
                <SelectItem value="neaktivni">Neaktivní</SelectItem>
              </SelectContent>
            </Select>

            <Select value={zdrojFilter} onValueChange={(v) => { setZdrojFilter(v ?? "vse"); setPage(1) }}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Zdroj" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vse">Všechny zdroje</SelectItem>
                <SelectItem value="sreality">Sreality</SelectItem>
                <SelectItem value="bezrealitky">Bezrealitky</SelectItem>
                <SelectItem value="doporuceni">Doporučení</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="web">Web</SelectItem>
                <SelectItem value="cold-call">Cold call</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabulka */}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
                Načítám klienty...
              </div>
            ) : paginated.length === 0 ? (
              <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
                Žádní klienti nenalezeni.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead
                      className="cursor-pointer select-none whitespace-nowrap"
                      onClick={() => handleSort("jmeno")}
                    >
                      <span className="flex items-center gap-1">
                        Jméno <SortIcon col="jmeno" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none whitespace-nowrap"
                      onClick={() => handleSort("email")}
                    >
                      <span className="flex items-center gap-1">
                        Email <SortIcon col="email" />
                      </span>
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Telefon</TableHead>
                    <TableHead className="whitespace-nowrap">Typ</TableHead>
                    <TableHead className="whitespace-nowrap">Zdroj</TableHead>
                    <TableHead
                      className="cursor-pointer select-none whitespace-nowrap"
                      onClick={() => handleSort("status")}
                    >
                      <span className="flex items-center gap-1">
                        Status <SortIcon col="status" />
                      </span>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer select-none whitespace-nowrap"
                      onClick={() => handleSort("datumPrvnihoKontaktu")}
                    >
                      <span className="flex items-center gap-1">
                        Datum kontaktu <SortIcon col="datumPrvnihoKontaktu" />
                      </span>
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">Akce</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50">
                      <TableCell>
                        <button
                          onClick={() => loadClientDetail(c.id)}
                          className="font-medium text-slate-900 hover:text-emerald-700 hover:underline text-left"
                        >
                          {c.jmeno} {c.prijmeni}
                        </button>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">{c.email}</TableCell>
                      <TableCell className="text-slate-600 text-sm whitespace-nowrap">{c.telefon}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            typBadgeClass(c.typ)
                          )}
                        >
                          {typBadgeLabel(c.typ)}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-600 text-sm">{c.zdroj}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            statusBadgeClass(c.status)
                          )}
                        >
                          {statusBadgeLabel(c.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                        {formatDate(c.datumPrvnihoKontaktu)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setEditingClient(c)
                              setShowAddDialog(true)
                            }}
                            title="Editovat"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => {
                              setDeleteError(null)
                              setDeleteConfirm(c)
                            }}
                            title="Smazat"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Paginace */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Předchozí
              </Button>
              <span className="text-sm text-slate-600">
                Strana {page} z {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Další
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════
            TAB 2: PIPELINE
        ══════════════════════════════════════════ */}
        <TabsContent value="pipeline">
          {/* Horní lišta */}
          <div className="flex items-center gap-3 flex-wrap mb-4">
            <h1 className="text-xl font-bold text-slate-900">Pipeline</h1>
            <Button
              onClick={() => setShowLeadDialog(true)}
              className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Přidat lead
            </Button>
          </div>

          {/* Statistiky */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-blue-500" />
                <span className="text-xs font-medium text-slate-500">Aktivní leady</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{pipelineStats.celkemAktivni}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium text-slate-500">Hodnota pipeline</span>
              </div>
              <div className="text-xl font-bold text-emerald-700">
                {pipelineStats.celkemHodnota > 0
                  ? formatPrice(pipelineStats.celkemHodnota)
                  : "—"}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span className="text-xs font-medium text-slate-500">Konverzní poměr</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{pipelineStats.conversionRate} %</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-slate-500" />
                <span className="text-xs font-medium text-slate-500">Celkem leadů</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{leads.length}</div>
            </div>
          </div>

          {/* Kanban */}
          {leadsLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
              Načítám pipeline...
            </div>
          ) : (
            <div className="overflow-x-auto pb-2">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-7 min-w-[1000px]">
                {LEAD_STATUSES.map((status) => {
                  const statusLeads = leads.filter((l) => l.status === status.id)
                  const statusValue = statusLeads.reduce(
                    (s, l) => s + (l.hodnotaObchodu ?? 0),
                    0
                  )
                  return (
                    <div
                      key={status.id}
                      className={cn(
                        "rounded-xl border-t-4 border border-slate-200 bg-slate-50 p-3",
                        PIPELINE_BORDER[status.id]
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-slate-700">
                          {status.label}
                        </span>
                        <span className="rounded-full bg-white border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
                          {statusLeads.length}
                        </span>
                      </div>
                      {statusValue > 0 && (
                        <div className="text-xs text-slate-400 mb-2">
                          {formatPrice(statusValue)}
                        </div>
                      )}
                      <div className="space-y-2">
                        {statusLeads.map((lead) => (
                          <LeadCard
                            key={lead.id}
                            lead={lead}
                            onStatusChange={handleLeadStatusChange}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => setShowLeadDialog(true)}
                        className="mt-2 w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                      >
                        + Přidat lead
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════
          ADD / EDIT DIALOG
      ══════════════════════════════════════════ */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(o) => {
          setShowAddDialog(o)
          if (!o) setEditingClient(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingClient ? "Editovat klienta" : "Přidat klienta"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-1">
            <ClientForm
              initial={editingClient}
              onSave={async (data) => {
                if (editingClient) {
                  await fetch(`/api/clients/${editingClient.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                  })
                } else {
                  await fetch("/api/clients", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(data),
                  })
                }
                setShowAddDialog(false)
                setEditingClient(null)
                loadClients()
              }}
              onCancel={() => {
                setShowAddDialog(false)
                setEditingClient(null)
              }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          DELETE DIALOG
      ══════════════════════════════════════════ */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(o) => {
          if (!o) {
            setDeleteConfirm(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Smazat klienta</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-700">
            Opravdu smazat klienta{" "}
            <strong>
              {deleteConfirm?.jmeno} {deleteConfirm?.prijmeni}
            </strong>
            ? Tato akce je nevratná.
          </div>
          {deleteError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirm(null)
                setDeleteError(null)
              }}
            >
              Zrušit
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteConfirm) return
                const res = await fetch(`/api/clients/${deleteConfirm.id}`, {
                  method: "DELETE",
                })
                if (!res.ok) {
                  const body = await res.json().catch(() => ({}))
                  setDeleteError(
                    body?.error ?? "Klienta nelze smazat. Má aktivní leady nebo jiné záznamy."
                  )
                } else {
                  setDeleteConfirm(null)
                  setDeleteError(null)
                  loadClients()
                }
              }}
            >
              Smazat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          ADD LEAD DIALOG
      ══════════════════════════════════════════ */}
      <Dialog
        open={showLeadDialog}
        onOpenChange={(o) => setShowLeadDialog(o)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Přidat lead</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-1">
            <LeadForm
              clients={clients}
              properties={properties}
              onSave={async (data) => {
                await fetch("/api/leads", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    klientId: data.klientId,
                    propertyId: data.propertyId || null,
                    hodnotaObchodu: data.hodnotaObchodu ? Number(data.hodnotaObchodu) : null,
                    zdroj: data.zdroj,
                    poznamka: data.poznamka || null,
                    status: "novy",
                  }),
                })
                setShowLeadDialog(false)
                loadLeads()
              }}
              onCancel={() => setShowLeadDialog(false)}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          DETAIL SHEET
      ══════════════════════════════════════════ */}
      <Sheet
        open={!!detailClient}
        onOpenChange={(o) => {
          if (!o) setDetailClient(null)
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {detailClient && (
            <>
              <SheetHeader className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      typBadgeClass(detailClient.typ)
                    )}
                  >
                    {typBadgeLabel(detailClient.typ)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      statusBadgeClass(detailClient.status)
                    )}
                  >
                    {statusBadgeLabel(detailClient.status)}
                  </span>
                </div>
                <SheetTitle className="text-base">
                  {detailClient.jmeno} {detailClient.prijmeni}
                </SheetTitle>
                <div className="text-xs text-slate-500 mt-0.5">{detailClient.email}</div>
              </SheetHeader>

              <div className="px-4 py-4 flex flex-col gap-5">
                {/* Kontaktní info */}
                <section>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Kontakt
                  </h3>
                  <div className="flex flex-col gap-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Telefon</span>
                      <span className="text-slate-800 font-medium">{detailClient.telefon}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Zdroj</span>
                      <span className="text-slate-800 font-medium">{detailClient.zdroj}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Makléř</span>
                      <span className="text-slate-800 font-medium">{detailClient.prirazenaMakler}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">První kontakt</span>
                      <span className="text-slate-800 font-medium">
                        {formatDate(detailClient.datumPrvnihoKontaktu)}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Statistiky */}
                {(() => {
                  const clientLeads = detailClient.leads ?? []
                  const clientSales = detailClient.purchasedSales ?? []
                  const totalValue = clientSales.reduce((s, sale) => s + sale.cenaFinalni, 0)
                  const uzavreno = clientLeads.filter((l) => l.status === "uzavreno").length
                  const convRate =
                    clientLeads.length > 0
                      ? Math.round((uzavreno / clientLeads.length) * 100)
                      : 0
                  return (
                    <section>
                      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Statistiky
                      </h3>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
                          <div className="text-lg font-bold text-slate-900">{clientLeads.length}</div>
                          <div className="text-[10px] text-slate-500">Leadů</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
                          <div className="text-lg font-bold text-slate-900">{convRate} %</div>
                          <div className="text-[10px] text-slate-500">Konverze</div>
                        </div>
                        <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 text-center">
                          <div className="text-lg font-bold text-emerald-700">
                            {clientSales.length}
                          </div>
                          <div className="text-[10px] text-slate-500">Prodejů</div>
                        </div>
                      </div>
                      {totalValue > 0 && (
                        <div className="mt-2 rounded-lg bg-emerald-50 border border-emerald-100 p-2.5 text-center">
                          <div className="text-sm font-bold text-emerald-800">
                            {formatPrice(totalValue)}
                          </div>
                          <div className="text-[10px] text-emerald-600 mt-0.5">
                            Celková hodnota obchodů
                          </div>
                        </div>
                      )}
                    </section>
                  )
                })()}

                {/* Leady */}
                {detailClient.leads && detailClient.leads.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Leady ({detailClient.leads.length})
                    </h3>
                    <div className="flex flex-col gap-2">
                      {detailClient.leads.map((lead) => {
                        const ls = LEAD_STATUSES.find((s) => s.id === lead.status)
                        return (
                          <div
                            key={lead.id}
                            className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-800">
                                {lead.property?.nazev ?? "Bez nemovitosti"}
                              </span>
                              {ls && (
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                    ls.color
                                  )}
                                >
                                  {ls.label}
                                </span>
                              )}
                            </div>
                            {lead.hodnotaObchodu != null && (
                              <div className="text-xs text-emerald-700 font-semibold mt-0.5">
                                {formatPrice(lead.hodnotaObchodu)}
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {formatDate(lead.datumVytvoreni)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {/* Prodeje */}
                {detailClient.purchasedSales && detailClient.purchasedSales.length > 0 && (
                  <section>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                      Prodeje ({detailClient.purchasedSales.length})
                    </h3>
                    <div className="flex flex-col gap-2">
                      {detailClient.purchasedSales.map((sale) => (
                        <div
                          key={sale.id}
                          className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-800">
                              {sale.property?.nazev ?? sale.propertyId}
                            </span>
                            <span className="text-xs font-bold text-emerald-700">
                              {formatPrice(sale.cenaFinalni)}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {formatDate(sale.datumProdeje)} · {sale.typObchodu}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Poznámka */}
                {detailClient.poznamka && (
                  <section>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      Poznámka
                    </h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{detailClient.poznamka}</p>
                  </section>
                )}

                <Separator />

                {/* Timeline */}
                <section>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Timeline
                  </h3>
                  <div className="flex flex-col gap-1.5 text-xs text-slate-600">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>
                        První kontakt: {formatDate(detailClient.datumPrvnihoKontaktu)}
                      </span>
                    </div>
                    {detailClient.leads && detailClient.leads.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                        <span>{detailClient.leads.length} leadů v systému</span>
                      </div>
                    )}
                    {detailClient.purchasedSales && detailClient.purchasedSales.length > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
                        <span>{detailClient.purchasedSales.length} uzavřených prodejů</span>
                      </div>
                    )}
                  </div>
                </section>
              </div>

              <SheetFooter className="border-t border-slate-100 pt-4">
                <div className="flex flex-wrap gap-2 w-full">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingClient(detailClient)
                      setShowAddDialog(true)
                    }}
                    className="flex-1"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editovat
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLeadDialog(true)}
                    className="flex-1"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Nový lead
                  </Button>
                  <Link
                    href={`/agent?prompt=Řekni mi vše o klientovi ${encodeURIComponent(detailClient.jmeno + " " + detailClient.prijmeni)}`}
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      <Bot className="h-3.5 w-3.5 mr-1" />
                      Zeptej se Pepy
                    </Button>
                  </Link>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
