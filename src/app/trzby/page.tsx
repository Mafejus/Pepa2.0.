"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"
import {
  Banknote,
  TrendingUp,
  ShoppingCart,
  BarChart2,
  Plus,
  Pencil,
  Trash2,
  Eye,
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/toast"

// ──────────────────────────────────────────────
// TYPY
// ──────────────────────────────────────────────

type Sale = {
  id: string
  propertyId: string
  klientId: string
  prodavajiciId: string
  datumProdeje: string
  cenaFinalni: number
  provize: number
  typObchodu: string
  property?: { id: string; nazev: string; lokalita: string }
  klient?: { id: string; jmeno: string; prijmeni: string; email: string; telefon: string }
  prodavajici?: { id: string; jmeno: string; prijmeni: string }
}

type Client = { id: string; jmeno: string; prijmeni: string }
type Property = { id: string; nazev: string; stav: string; lokalita: string }

type SaleFormData = {
  propertyId: string
  kupujiciId: string
  prodavajiciId: string
  datumProdeje: string
  cenaFinalni: string
  provize: string
  typObchodu: string
}

// ──────────────────────────────────────────────
// KONSTANTY
// ──────────────────────────────────────────────

const MAKLERI = ["Pepa Novák", "Jana Dvořáková", "Martin Svoboda"]

const PERIOD_OPTIONS = [
  { value: "tento_mesic", label: "Tento měsíc" },
  { value: "minuly_mesic", label: "Minulý měsíc" },
  { value: "q1_2026", label: "Q1 2026" },
  { value: "poslednich_6", label: "Posledních 6 měsíců" },
  { value: "vse", label: "Celé období" },
]

const PIE_COLORS = ["#10b981", "#3b82f6"]

// ──────────────────────────────────────────────
// POMOCNÉ FUNKCE
// ──────────────────────────────────────────────

function formatCZK(n: number): string {
  return n.toLocaleString("cs-CZ") + " Kč"
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ")
}

function getMonthLabel(isoMonth: string): string {
  const [year, month] = isoMonth.split("-")
  const d = new Date(parseInt(year), parseInt(month) - 1, 1)
  return d.toLocaleDateString("cs-CZ", { month: "short", year: "2-digit" })
}

function getPeriodRange(period: string): { from: Date | null; to: Date | null } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()

  if (period === "tento_mesic") {
    return { from: new Date(y, m, 1), to: new Date(y, m + 1, 0) }
  }
  if (period === "minuly_mesic") {
    return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) }
  }
  if (period === "q1_2026") {
    return { from: new Date(2026, 0, 1), to: new Date(2026, 2, 31) }
  }
  if (period === "poslednich_6") {
    const from = new Date(y, m - 5, 1)
    return { from, to: now }
  }
  return { from: null, to: null }
}

// ──────────────────────────────────────────────
// SALE FORM
// ──────────────────────────────────────────────

function SaleForm({
  initial,
  clients,
  properties,
  onSave,
  onCancel,
}: {
  initial: Sale | null
  clients: Client[]
  properties: Property[]
  onSave: (data: SaleFormData) => Promise<void>
  onCancel: () => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState<SaleFormData>({
    propertyId: initial?.propertyId ?? "",
    kupujiciId: initial?.klientId ?? "",
    prodavajiciId: initial?.prodavajiciId ?? "",
    datumProdeje: initial?.datumProdeje
      ? new Date(initial.datumProdeje).toISOString().slice(0, 10)
      : today,
    cenaFinalni: initial?.cenaFinalni?.toString() ?? "",
    provize: initial?.provize?.toString() ?? "",
    typObchodu: initial?.typObchodu ?? "prodej",
  })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  function field(key: keyof SaleFormData, value: string) {
    setForm((prev) => {
      const next = { ...prev, [key]: value }
      // Auto-výpočet provize při změně ceny
      if (key === "cenaFinalni" && value) {
        const cena = parseFloat(value.replace(/\s/g, ""))
        if (!isNaN(cena) && !initial) {
          next.provize = Math.round(cena * 0.03).toString()
        }
      }
      return next
    })
  }

  async function handleSubmit() {
    const errs: string[] = []
    if (!form.propertyId) errs.push("Nemovitost je povinná")
    if (!form.kupujiciId) errs.push("Kupující je povinný")
    if (!form.prodavajiciId) errs.push("Prodávající je povinný")
    if (!form.cenaFinalni) errs.push("Finální cena je povinná")
    if (!form.datumProdeje) errs.push("Datum prodeje je povinné")
    if (errs.length > 0) { setErrors(errs); return }
    setErrors([])
    setSaving(true)
    try { await onSave(form) } finally { setSaving(false) }
  }

  const availableProperties = initial
    ? properties
    : properties.filter((p) => p.stav === "aktivni" || p.stav === "pripravuje_se")

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {errors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-700">Nemovitost *</label>
        <Select value={form.propertyId} onValueChange={(v) => field("propertyId", v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="Vyberte nemovitost" />
          </SelectTrigger>
          <SelectContent>
            {availableProperties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.nazev}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-700">Kupující *</label>
          <Select value={form.kupujiciId} onValueChange={(v) => field("kupujiciId", v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Kupující" />
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
          <label className="text-xs font-medium text-slate-700">Prodávající *</label>
          <Select value={form.prodavajiciId} onValueChange={(v) => field("prodavajiciId", v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Prodávající" />
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
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-700">Datum prodeje *</label>
        <Input
          type="date"
          value={form.datumProdeje}
          onChange={(e) => field("datumProdeje", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-700">Finální cena (Kč) *</label>
          <Input
            type="number"
            value={form.cenaFinalni}
            onChange={(e) => field("cenaFinalni", e.target.value)}
            placeholder="5 500 000"
            min={0}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-700">Provize (Kč)</label>
          <Input
            type="number"
            value={form.provize}
            onChange={(e) => field("provize", e.target.value)}
            placeholder="auto (3 %)"
            min={0}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-slate-700">Typ obchodu *</label>
        <Select value={form.typObchodu} onValueChange={(v) => field("typObchodu", v ?? "prodej")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="prodej">Prodej</SelectItem>
            <SelectItem value="pronajem">Pronájem</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Zrušit
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
        >
          {saving ? "Ukládám…" : initial ? "Uložit změny" : "Přidat prodej"}
        </Button>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// HLAVNÍ STRÁNKA
// ──────────────────────────────────────────────

const PAGE_SIZE = 15

export default function TrzbyPage() {
  const [sales, setSales] = useState<Sale[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  const [filterPeriod, setFilterPeriod] = useState("poslednich_6")
  const [filterTyp, setFilterTyp] = useState("vse")
  const [filterMakler, setFilterMakler] = useState("vse")

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingSale, setEditingSale] = useState<Sale | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Sale | null>(null)
  const [detailSale, setDetailSale] = useState<Sale | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [sortKey, setSortKey] = useState<"datumProdeje" | "cenaFinalni" | "provize">("datumProdeje")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)

  // ── Data loading ──
  const loadSales = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/sales")
      if (res.ok) setSales(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  const loadClients = useCallback(async () => {
    const res = await fetch("/api/clients")
    if (res.ok) setClients(await res.json())
  }, [])

  const loadProperties = useCallback(async () => {
    const res = await fetch("/api/properties")
    if (res.ok) setProperties(await res.json())
  }, [])

  useEffect(() => {
    loadSales()
    loadClients()
    loadProperties()
  }, [loadSales, loadClients, loadProperties])

  // ── Filtering ──
  const filteredSales = useMemo(() => {
    const { from, to } = getPeriodRange(filterPeriod)
    return sales.filter((s) => {
      const d = new Date(s.datumProdeje)
      if (from && d < from) return false
      if (to && d > to) return false
      if (filterTyp !== "vse" && s.typObchodu !== filterTyp) return false
      // No makler field in sales — skip makler filter for now
      return true
    })
  }, [sales, filterPeriod, filterTyp, filterMakler])

  // ── Stats ──
  const stats = useMemo(() => {
    const celkoveTrzby = filteredSales.reduce((s, x) => s + x.cenaFinalni, 0)
    const celkoveProvizy = filteredSales.reduce((s, x) => s + x.provize, 0)
    const pocetObchodu = filteredSales.length
    const prumernaProvize = pocetObchodu > 0 ? Math.round(celkoveProvizy / pocetObchodu) : 0
    return { celkoveTrzby, celkoveProvizy, pocetObchodu, prumernaProvize }
  }, [filteredSales])

  // ── Monthly chart data ──
  const monthlyData = useMemo(() => {
    const map: Record<string, { trzby: number; count: number }> = {}
    filteredSales.forEach((s) => {
      const key = s.datumProdeje.slice(0, 7)
      if (!map[key]) map[key] = { trzby: 0, count: 0 }
      map[key].trzby += s.cenaFinalni
      map[key].count += 1
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month: getMonthLabel(month),
        trzby: Math.round(v.trzby / 1000),
        pocet: v.count,
      }))
  }, [filteredSales])

  // ── Pie chart data ──
  const typeData = useMemo(() => {
    const prodej = filteredSales.filter((s) => s.typObchodu === "prodej").length
    const pronajem = filteredSales.filter((s) => s.typObchodu === "pronajem").length
    return [
      { name: "Prodej", value: prodej },
      { name: "Pronájem", value: pronajem },
    ].filter((d) => d.value > 0)
  }, [filteredSales])

  // ── Sorting + pagination ──
  const sorted = useMemo(() => {
    const arr = [...filteredSales]
    arr.sort((a, b) => {
      let av: number, bv: number
      if (sortKey === "datumProdeje") {
        av = new Date(a.datumProdeje).getTime()
        bv = new Date(b.datumProdeje).getTime()
      } else {
        av = a[sortKey]
        bv = b[sortKey]
      }
      return sortDir === "asc" ? av - bv : bv - av
    })
    return arr
  }, [filteredSales, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleSort(key: typeof sortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("desc") }
    setPage(1)
  }

  // ── CRUD ──
  async function handleSaveSale(data: SaleFormData) {
    const payload = {
      propertyId: data.propertyId,
      klientId: data.kupujiciId,
      prodavajiciId: data.prodavajiciId,
      datumProdeje: data.datumProdeje,
      cenaFinalni: parseFloat(data.cenaFinalni),
      provize: data.provize
        ? parseFloat(data.provize)
        : Math.round(parseFloat(data.cenaFinalni) * 0.03),
      typObchodu: data.typObchodu,
    }

    if (editingSale) {
      const res = await fetch(`/api/sales/${editingSale.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast("Prodej aktualizován")
        setEditingSale(null)
        setShowAddDialog(false)
        loadSales()
      } else {
        const body = await res.json().catch(() => ({}))
        toast(body.error ?? "Chyba při aktualizaci", "error")
      }
    } else {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        toast("Prodej přidán")
        setShowAddDialog(false)
        loadSales()
        loadProperties()
      } else {
        const body = await res.json().catch(() => ({}))
        toast(body.error ?? "Chyba při vytváření", "error")
      }
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/sales/${id}`, { method: "DELETE" })
    if (res.ok) {
      toast("Prodej smazán")
      setDeleteConfirm(null)
      loadSales()
      loadProperties()
    } else {
      const body = await res.json().catch(() => ({}))
      setDeleteError(body.error ?? "Chyba při mazání")
    }
  }

  // ── Badges ──
  function typBadge(typ: string) {
    return typ === "prodej"
      ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
      : "bg-blue-500/10 text-blue-700 border-blue-200"
  }

  function SortIcon({ col }: { col: typeof sortKey }) {
    if (sortKey !== col) return null
    return sortDir === "asc"
      ? <ChevronUp className="inline h-3.5 w-3.5 ml-0.5" />
      : <ChevronDown className="inline h-3.5 w-3.5 ml-0.5" />
  }

  // ──────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Nadpis */}
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold text-slate-900">Tržby</h1>
        <Badge variant="secondary">{filteredSales.length} prodejů</Badge>
        <Button
          onClick={() => { setEditingSale(null); setShowAddDialog(true) }}
          className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white border-0"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-1" />
          Přidat prodej
        </Button>
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterPeriod} onValueChange={(v) => { setFilterPeriod(v ?? "poslednich_6"); setPage(1) }}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterTyp} onValueChange={(v) => { setFilterTyp(v ?? "vse"); setPage(1) }}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vse" className="text-xs">Vše</SelectItem>
            <SelectItem value="prodej" className="text-xs">Prodej</SelectItem>
            <SelectItem value="pronajem" className="text-xs">Pronájem</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterMakler} onValueChange={(v) => { setFilterMakler(v ?? "vse"); setPage(1) }}>
          <SelectTrigger className="w-44 h-8 text-xs">
            <SelectValue placeholder="Všichni makléři" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vse" className="text-xs">Všichni makléři</SelectItem>
            {MAKLERI.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI karty */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="h-4 w-4 text-emerald-500" />
            <span className="text-xs font-medium text-slate-500">Celkové tržby</span>
          </div>
          <div className="text-xl font-bold text-slate-900 truncate">
            {formatCZK(stats.celkoveTrzby)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-medium text-slate-500">Celkové provize</span>
          </div>
          <div className="text-xl font-bold text-emerald-700 truncate">
            {formatCZK(stats.celkoveProvizy)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <ShoppingCart className="h-4 w-4 text-purple-500" />
            <span className="text-xs font-medium text-slate-500">Počet obchodů</span>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.pocetObchodu}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BarChart2 className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-medium text-slate-500">Průměrná provize</span>
          </div>
          <div className="text-xl font-bold text-slate-900 truncate">
            {stats.pocetObchodu > 0 ? formatCZK(stats.prumernaProvize) : "—"}
          </div>
        </div>
      </div>

      {/* Grafy */}
      {monthlyData.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Tržby po měsících */}
          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-700 mb-3">Tržby po měsících (tis. Kč)</div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(v) => [`${Number(v)} tis. Kč`, "Tržby"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="trzby" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Rozložení podle typu */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-700 mb-3">Typ obchodu</div>
            {typeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${percent != null ? (percent * 100).toFixed(0) : 0}%`
                    }
                    labelLine={false}
                  >
                    {typeData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
                Žádná data
              </div>
            )}
          </div>
        </div>
      )}

      {/* Počet obchodů - line chart */}
      {monthlyData.length > 1 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-700 mb-3">Počet obchodů po měsících</div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={monthlyData} margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                formatter={(v) => [Number(v), "Obchodů"]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Line
                type="monotone"
                dataKey="pocet"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabulka prodejů */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-2">
          <div className="text-sm font-semibold text-slate-700">Přehled prodejů</div>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            Načítám data…
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
            Žádné prodeje v tomto období
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className="whitespace-nowrap cursor-pointer select-none"
                    onClick={() => handleSort("datumProdeje")}
                  >
                    Datum <SortIcon col="datumProdeje" />
                  </TableHead>
                  <TableHead>Nemovitost</TableHead>
                  <TableHead>Kupující</TableHead>
                  <TableHead>Prodávající</TableHead>
                  <TableHead
                    className="whitespace-nowrap cursor-pointer select-none text-right"
                    onClick={() => handleSort("cenaFinalni")}
                  >
                    Fin. cena <SortIcon col="cenaFinalni" />
                  </TableHead>
                  <TableHead
                    className="whitespace-nowrap cursor-pointer select-none text-right"
                    onClick={() => handleSort("provize")}
                  >
                    Provize <SortIcon col="provize" />
                  </TableHead>
                  <TableHead className="whitespace-nowrap">Typ</TableHead>
                  <TableHead className="text-right">Akce</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((s) => (
                  <TableRow key={s.id} className="hover:bg-slate-50">
                    <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                      {formatDate(s.datumProdeje)}
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => setDetailSale(s)}
                        className="text-sm font-medium text-slate-900 hover:text-emerald-700 hover:underline text-left truncate max-w-[180px] block"
                      >
                        {s.property?.nazev ?? s.propertyId}
                      </button>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                      {s.klient ? `${s.klient.jmeno} ${s.klient.prijmeni}` : "—"}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                      {s.prodavajici ? `${s.prodavajici.jmeno} ${s.prodavajici.prijmeni}` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-900 whitespace-nowrap">
                      {formatCZK(s.cenaFinalni)}
                    </TableCell>
                    <TableCell className="text-right text-emerald-700 font-medium whitespace-nowrap">
                      {formatCZK(s.provize)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
                          typBadge(s.typObchodu)
                        )}
                      >
                        {s.typObchodu === "prodej" ? "Prodej" : "Pronájem"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDetailSale(s)}
                          title="Detail"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => { setEditingSale(s); setShowAddDialog(true) }}
                          title="Editovat"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => { setDeleteError(null); setDeleteConfirm(s) }}
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
          </div>
        )}
      </div>

      {/* Paginace */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
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

      {/* ══════════════════════════════════════════
          PŘIDAT / EDITOVAT DIALOG
      ══════════════════════════════════════════ */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(o) => {
          setShowAddDialog(o)
          if (!o) setEditingSale(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSale ? "Editovat prodej" : "Přidat prodej"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-1">
            <SaleForm
              initial={editingSale}
              clients={clients}
              properties={properties}
              onSave={handleSaveSale}
              onCancel={() => { setShowAddDialog(false); setEditingSale(null) }}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          SMAZAT DIALOG
      ══════════════════════════════════════════ */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(o) => { if (!o) { setDeleteConfirm(null); setDeleteError(null) } }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Smazat prodej</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-slate-700">
            Opravdu smazat prodej nemovitosti{" "}
            <strong>{deleteConfirm?.property?.nazev ?? deleteConfirm?.propertyId}</strong>?
            Nemovitost bude vrácena do stavu aktivní.
          </div>
          {deleteError && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteConfirm(null); setDeleteError(null) }}
            >
              Zrušit
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteConfirm) await handleDelete(deleteConfirm.id)
              }}
            >
              Smazat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════
          DETAIL SHEET
      ══════════════════════════════════════════ */}
      <Sheet
        open={!!detailSale}
        onOpenChange={(o) => { if (!o) setDetailSale(null) }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          {detailSale && (
            <>
              <SheetHeader className="border-b border-slate-100 pb-4">
                <div className="mb-1">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      typBadge(detailSale.typObchodu)
                    )}
                  >
                    {detailSale.typObchodu === "prodej" ? "Prodej" : "Pronájem"}
                  </span>
                </div>
                <SheetTitle className="text-base">
                  {detailSale.property?.nazev ?? "Detail prodeje"}
                </SheetTitle>
                <div className="text-xs text-slate-500">
                  {detailSale.property?.lokalita}
                </div>
              </SheetHeader>

              <div className="px-4 py-4 flex flex-col gap-5">
                {/* Finanční přehled */}
                <section>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Finance
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                      <div className="text-[10px] text-slate-500 mb-0.5">Finální cena</div>
                      <div className="text-sm font-bold text-slate-900">
                        {formatCZK(detailSale.cenaFinalni)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                      <div className="text-[10px] text-slate-500 mb-0.5">Provize</div>
                      <div className="text-sm font-bold text-emerald-700">
                        {formatCZK(detailSale.provize)}
                      </div>
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Strany */}
                <section>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Strany obchodu
                  </h3>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex flex-col gap-0.5 rounded-lg bg-slate-50 border border-slate-100 p-3">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Kupující</div>
                      {detailSale.klient ? (
                        <>
                          <div className="font-medium text-slate-900">
                            {detailSale.klient.jmeno} {detailSale.klient.prijmeni}
                          </div>
                          <div className="text-slate-500 text-xs">{detailSale.klient.email}</div>
                          <div className="text-slate-500 text-xs">{detailSale.klient.telefon}</div>
                        </>
                      ) : (
                        <div className="text-slate-400">—</div>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 rounded-lg bg-slate-50 border border-slate-100 p-3">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Prodávající</div>
                      {detailSale.prodavajici ? (
                        <div className="font-medium text-slate-900">
                          {detailSale.prodavajici.jmeno} {detailSale.prodavajici.prijmeni}
                        </div>
                      ) : (
                        <div className="text-slate-400">—</div>
                      )}
                    </div>
                  </div>
                </section>

                <Separator />

                {/* Info */}
                <section>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Informace
                  </h3>
                  <div className="flex flex-col gap-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Datum prodeje</span>
                      <span className="font-medium text-slate-800">
                        {formatDate(detailSale.datumProdeje)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Typ obchodu</span>
                      <span className="font-medium text-slate-800 capitalize">
                        {detailSale.typObchodu === "prodej" ? "Prodej" : "Pronájem"}
                      </span>
                    </div>
                    {detailSale.property && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Lokalita</span>
                        <span className="font-medium text-slate-800">
                          {detailSale.property.lokalita}
                        </span>
                      </div>
                    )}
                  </div>
                </section>

                <Separator />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setDetailSale(null)
                      setEditingSale(detailSale)
                      setShowAddDialog(true)
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Editovat
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setDetailSale(null)
                      setDeleteError(null)
                      setDeleteConfirm(detailSale)
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Smazat
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
