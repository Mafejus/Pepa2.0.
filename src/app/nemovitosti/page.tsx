"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"

type Property = {
  id: string
  nazev: string
  typ: "byt" | "dum" | "pozemek" | "komercni"
  lokalita: string
  cena: number
  koupenoZa: number | null
  plocha: number
  dispozice: string
  stav: "aktivni" | "prodano" | "rezervovano" | "pripravuje_se"
  majitel: string
  majitelKontakt: string
  rokRekonstrukce: number | null
  stavebniUpravy: string | null
  energetickaTrida: string | null
  fotky: boolean
  popisPopis: boolean
  datumNasazeni: string
  poznamka: string | null
}

type Client = {
  id: string
  jmeno: string
  prijmeni: string
}
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Bot,
  ArrowRight,
  Search,
  AlertTriangle,
  Home,
  Building2,
  Trees,
  Store,
  MapPin,
  Ruler,
  CalendarDays,
  User,
  Mail,
  Tag,
  Zap,
  Camera,
  FileText,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  ShoppingCart,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────

function formatPrice(price: number): string {
  if (price < 100_000) {
    return `${price.toLocaleString("cs-CZ")} Kč/měs.`
  }
  if (price >= 1_000_000) {
    const val = price / 1_000_000
    return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)} mil. Kč`
  }
  return `${price.toLocaleString("cs-CZ")} Kč`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  })
}

function hasMissingData(p: Property): boolean {
  return !p.fotky || !p.popisPopis || p.rokRekonstrukce === null || p.energetickaTrida === null
}

const TYP_LABELS: Record<Property["typ"], string> = {
  byt: "Byt",
  dum: "Dům",
  pozemek: "Pozemek",
  komercni: "Komerční",
}

const TYP_ICONS: Record<Property["typ"], React.ComponentType<{ className?: string }>> = {
  byt: Home,
  dum: Building2,
  pozemek: Trees,
  komercni: Store,
}

const TYP_COLORS: Record<Property["typ"], string> = {
  byt: "bg-blue-50 text-blue-600",
  dum: "bg-emerald-50 text-emerald-600",
  pozemek: "bg-amber-50 text-amber-600",
  komercni: "bg-purple-50 text-purple-600",
}

const STAV_CONFIG: Record<
  Property["stav"],
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  aktivni: { label: "Aktivní", variant: "default" },
  prodano: { label: "Prodáno", variant: "secondary" },
  rezervovano: { label: "Rezervováno", variant: "outline" },
  pripravuje_se: { label: "Připravuje se", variant: "outline" },
}

// ──────────────────────────────────────────────
// PROPERTY CARD
// ──────────────────────────────────────────────

function PropertyCard({
  property,
  onClick,
}: {
  property: Property
  onClick: () => void
}) {
  const Icon = TYP_ICONS[property.typ]
  const stavCfg = STAV_CONFIG[property.stav]
  const missing = hasMissingData(property)

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white shadow-sm hover:border-emerald-300 hover:shadow-md transition-all duration-150 overflow-hidden flex flex-col"
    >
      {/* Color header */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3",
          TYP_COLORS[property.typ]
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">
          {TYP_LABELS[property.typ]}
        </span>
        {missing && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            Neúplná data
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 px-4 py-3 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[13px] font-semibold text-slate-800 leading-snug">
            {property.nazev}
          </h3>
          <Badge
            variant={stavCfg.variant}
            className="shrink-0 text-[10px]"
          >
            {stavCfg.label}
          </Badge>
        </div>

        <div className="flex items-center gap-1 text-[12px] text-slate-500">
          <MapPin className="h-3 w-3 shrink-0" />
          <span>{property.lokalita}</span>
        </div>

        <div className="flex items-center gap-3 text-[12px] text-slate-600">
          <span className="flex items-center gap-1">
            <Ruler className="h-3 w-3" />
            {property.plocha} m²
          </span>
          <span className="text-slate-300">·</span>
          <span>{property.dispozice}</span>
        </div>

        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-[14px] font-bold text-slate-900">
            {formatPrice(property.cena)}
          </span>
          <span className="text-[10px] text-slate-400">
            {formatDate(property.datumNasazeni)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// PROPERTY DETAIL SHEET
// ──────────────────────────────────────────────

function DataRow({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | null | undefined
  ok?: boolean
}) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-50 last:border-0">
      <Icon className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
      <span className="text-[11px] text-slate-500 w-28 shrink-0">{label}</span>
      <span
        className={cn(
          "text-[12px] font-medium flex-1",
          ok === false ? "text-amber-600" : "text-slate-700"
        )}
      >
        {value ?? (
          <span className="text-amber-500 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Chybí
          </span>
        )}
      </span>
    </div>
  )
}

const EMPTY_SALE = {
  klientId: "",
  prodavajiciId: "",
  cenaFinalni: "",
  provize: "",
  datumProdeje: new Date().toISOString().slice(0, 10),
}

function SellDialog({
  property,
  open,
  onClose,
  onSold,
}: {
  property: Property
  open: boolean
  onClose: () => void
  onSold: () => void
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [form, setSaleForm] = useState({ ...EMPTY_SALE, cenaFinalni: String(property.cena) })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      fetch("/api/clients")
        .then((r) => r.json())
        .then((data) => setClients(Array.isArray(data) ? data : []))
        .catch(() => setClients([]))
      setSaleForm({ ...EMPTY_SALE, cenaFinalni: String(property.cena) })
      setError(null)
    }
  }, [open, property.cena])

  function setF(key: string, value: string) {
    setSaleForm((prev) => {
      const next = { ...prev, [key]: value }
      if (key === "cenaFinalni") {
        const c = parseFloat(value) || 0
        next.provize = c > 0 ? String(Math.round(c * 0.03)) : prev.provize
      }
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          klientId: form.klientId,
          prodavajiciId: form.prodavajiciId,
          cenaFinalni: parseFloat(form.cenaFinalni),
          provize: parseFloat(form.provize),
          typObchodu: "prodej",
          datumProdeje: new Date(form.datumProdeje).toISOString(),
        }),
      })
      if (!res.ok) throw new Error("Chyba při ukládání")
      onSold()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="border-b border-slate-100 pb-4">
          <SheetTitle className="text-base">Prodat nemovitost</SheetTitle>
          <p className="text-[12px] text-slate-500 mt-0.5">{property.nazev}</p>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="px-4 py-4 flex flex-col gap-4">
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Kupující (klient) *</label>
            <Select value={form.klientId} onValueChange={(v) => setF("klientId", v ?? "")}>
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue placeholder="Vyberte kupujícího…" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.jmeno} {c.prijmeni}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Prodávající (klient) *</label>
            <Select value={form.prodavajiciId} onValueChange={(v) => setF("prodavajiciId", v ?? "")}>
              <SelectTrigger className="h-8 text-[13px]">
                <SelectValue placeholder="Vyberte prodávajícího…" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.jmeno} {c.prijmeni}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Konečná cena (Kč) *</label>
              <Input
                required
                type="number"
                value={form.cenaFinalni}
                onChange={(e) => setF("cenaFinalni", e.target.value)}
                className="h-8 text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Provize (Kč) *</label>
              <Input
                required
                type="number"
                value={form.provize}
                onChange={(e) => setF("provize", e.target.value)}
                placeholder="3 % z ceny"
                className="h-8 text-[13px]"
              />
            </div>
          </div>
          {property.koupenoZa && form.cenaFinalni && parseFloat(form.cenaFinalni) > 0 && (
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 text-[12px] text-slate-600">
              Zisk z prodeje:{" "}
              <span className={cn(
                "font-semibold",
                parseFloat(form.cenaFinalni) - property.koupenoZa >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {formatPrice(parseFloat(form.cenaFinalni) - property.koupenoZa)}
              </span>
              {" "}(prodejní – nákupní cena)
            </div>
          )}
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Datum prodeje *</label>
            <Input
              required
              type="date"
              value={form.datumProdeje}
              onChange={(e) => setF("datumProdeje", e.target.value)}
              className="h-8 text-[13px]"
            />
          </div>
          {error && (
            <p className="text-[12px] text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}
          <SheetFooter className="border-t border-slate-100 pt-4 mt-0">
            <button
              type="submit"
              disabled={saving || !form.klientId || !form.prodavajiciId}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-500 text-white text-[13px] font-medium px-4 py-2 hover:bg-emerald-600 transition-colors disabled:opacity-60"
            >
              <ShoppingCart className="h-4 w-4" />
              {saving ? "Ukládám…" : "Zaznamenat prodej"}
            </button>
            <SheetClose className="flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 text-[13px] font-medium px-4 py-2 hover:bg-slate-50 transition-colors">
              Zrušit
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function PropertySheet({
  property,
  onClose,
  onDelete,
  onUpdated,
}: {
  property: Property | null
  onClose: () => void
  onDelete: (id: string) => void
  onUpdated: (p: Property) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sellOpen, setSellOpen] = useState(false)

  if (!property) return null

  const Icon = TYP_ICONS[property.typ]
  const stavCfg = STAV_CONFIG[property.stav]

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/properties/${property!.id}`, { method: "DELETE" })
      if (res.ok) {
        onDelete(property!.id)
        onClose()
      }
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <Sheet open={!!property} onOpenChange={(open) => { if (!open) { setConfirmDelete(false); onClose() } }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("flex h-7 w-7 items-center justify-center rounded-lg", TYP_COLORS[property.typ])}>
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
              {TYP_LABELS[property.typ]}
            </span>
            <Badge variant={stavCfg.variant} className="ml-auto text-[10px]">
              {stavCfg.label}
            </Badge>
          </div>
          <SheetTitle className="text-base leading-snug">{property.nazev}</SheetTitle>
          <div className="flex items-center gap-1 text-[12px] text-slate-500 mt-1">
            <MapPin className="h-3 w-3" />
            {property.lokalita}
          </div>
        </SheetHeader>

        <div className="px-4 py-4 flex flex-col gap-4">
          {/* Price + area */}
          <div className="flex gap-3">
            <div className="flex-1 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
              <div className="text-[10px] text-emerald-600 font-medium mb-0.5">Cena</div>
              <div className="text-[15px] font-bold text-slate-900">{formatPrice(property.cena)}</div>
            </div>
            <div className="flex-1 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <div className="text-[10px] text-slate-500 font-medium mb-0.5">Plocha</div>
              <div className="text-[15px] font-bold text-slate-900">{property.plocha} m²</div>
            </div>
            <div className="flex-1 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <div className="text-[10px] text-slate-500 font-medium mb-0.5">Dispozice</div>
              <div className="text-[15px] font-bold text-slate-900">{property.dispozice}</div>
            </div>
          </div>

          {/* Koupeno za */}
          {property.koupenoZa != null && (
            <div className="flex gap-3">
              <div className="flex-1 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                <div className="text-[10px] text-blue-600 font-medium mb-0.5">Koupeno za</div>
                <div className="text-[14px] font-bold text-slate-900">{formatPrice(property.koupenoZa)}</div>
              </div>
              <div className="flex-1 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                <div className="text-[10px] text-slate-500 font-medium mb-0.5">Očekávaný zisk</div>
                <div className={cn(
                  "text-[14px] font-bold",
                  property.cena - property.koupenoZa >= 0 ? "text-emerald-600" : "text-red-500"
                )}>
                  {formatPrice(property.cena - property.koupenoZa)}
                </div>
              </div>
            </div>
          )}

          {/* Majitel */}
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Majitel</div>
            <DataRow icon={User} label="Jméno" value={property.majitel} />
            <DataRow icon={Mail} label="Kontakt" value={property.majitelKontakt} />
          </div>

          {/* Technické info */}
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Technické info</div>
            <DataRow
              icon={Tag}
              label="Rok rekonstrukce"
              value={property.rokRekonstrukce ? String(property.rokRekonstrukce) : null}
            />
            <DataRow
              icon={Tag}
              label="Stavební úpravy"
              value={property.stavebniUpravy}
            />
            <DataRow
              icon={Zap}
              label="Energetická třída"
              value={property.energetickaTrida}
            />
            <DataRow
              icon={CalendarDays}
              label="Nasazeno"
              value={formatDate(property.datumNasazeni)}
            />
          </div>

          {/* Stav podkladů */}
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Stav podkladů</div>
            <div className="flex gap-3">
              <div className={cn(
                "flex-1 flex items-center gap-2 rounded-lg border px-3 py-2",
                property.fotky
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              )}>
                {property.fotky
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : <XCircle className="h-4 w-4 text-amber-500" />}
                <div>
                  <Camera className="h-3 w-3 text-slate-400 inline mr-1" />
                  <span className="text-[11px] font-medium text-slate-700">Fotografie</span>
                </div>
              </div>
              <div className={cn(
                "flex-1 flex items-center gap-2 rounded-lg border px-3 py-2",
                property.popisPopis
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              )}>
                {property.popisPopis
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  : <XCircle className="h-4 w-4 text-amber-500" />}
                <div>
                  <FileText className="h-3 w-3 text-slate-400 inline mr-1" />
                  <span className="text-[11px] font-medium text-slate-700">Popis</span>
                </div>
              </div>
            </div>
          </div>

          {/* Poznámka */}
          {property.poznamka && (
            <div>
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Poznámka</div>
              <p className="text-[12px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2 leading-relaxed border border-slate-100">
                {property.poznamka}
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="border-t border-slate-100 pt-4 mt-0 flex-col gap-2">
          {property.stav !== "prodano" && (
            <button
              onClick={() => setSellOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-500 text-white text-[13px] font-medium px-4 py-2 hover:bg-blue-600 transition-colors"
            >
              <ShoppingCart className="h-4 w-4" />
              Prodat nemovitost
            </button>
          )}
          <div className="flex gap-2 w-full">
            <Link
              href={`/agent?prompt=${encodeURIComponent(`Řekni mi více o nemovitosti ${property.nazev}`)}`}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-500 text-white text-[13px] font-medium px-4 py-2 hover:bg-emerald-600 transition-colors"
            >
              <Bot className="h-4 w-4" />
              Zeptat se Pepy
            </Link>
            <SheetClose className="flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 text-[13px] font-medium px-4 py-2 hover:bg-slate-50 transition-colors">
              Zavřít
            </SheetClose>
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-lg border text-[13px] font-medium px-4 py-2 transition-colors",
              confirmDelete
                ? "border-red-300 bg-red-500 text-white hover:bg-red-600"
                : "border-red-200 text-red-600 hover:bg-red-50"
            )}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Mazání…" : confirmDelete ? "Opravdu smazat?" : "Smazat nemovitost"}
          </button>
        </SheetFooter>
      </SheetContent>
      {sellOpen && (
        <SellDialog
          property={property}
          open={sellOpen}
          onClose={() => setSellOpen(false)}
          onSold={() => {
            const updated = { ...property, stav: "prodano" as Property["stav"] }
            onUpdated(updated)
            setSellOpen(false)
            onClose()
          }}
        />
      )}
    </Sheet>
  )
}

// ──────────────────────────────────────────────
// ADD PROPERTY DIALOG
// ──────────────────────────────────────────────

const EMPTY_FORM = {
  nazev: "",
  typ: "byt" as Property["typ"],
  lokalita: "",
  cena: "",
  koupenoZa: "",
  plocha: "",
  dispozice: "",
  stav: "aktivni" as Property["stav"],
  majitel: "",
  majitelKontakt: "",
  rokRekonstrukce: "",
  stavebniUpravy: "",
  energetickaTrida: "",
  fotky: false,
  popisPopis: false,
  datumNasazeni: new Date().toISOString().slice(0, 10),
  poznamka: "",
}

function AddPropertySheet({
  open,
  onClose,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  onAdded: (p: Property) => void
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body = {
        nazev: form.nazev,
        typ: form.typ,
        lokalita: form.lokalita,
        cena: parseFloat(form.cena),
        koupenoZa: form.koupenoZa ? parseFloat(form.koupenoZa) : null,
        plocha: parseFloat(form.plocha),
        dispozice: form.dispozice,
        stav: form.stav,
        majitel: form.majitel,
        majitelKontakt: form.majitelKontakt,
        rokRekonstrukce: form.rokRekonstrukce ? parseInt(form.rokRekonstrukce) : null,
        stavebniUpravy: form.stavebniUpravy || null,
        energetickaTrida: form.energetickaTrida || null,
        fotky: form.fotky,
        popisPopis: form.popisPopis,
        datumNasazeni: new Date(form.datumNasazeni).toISOString(),
        poznamka: form.poznamka || null,
      }
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error("Chyba při ukládání")
      const created: Property = await res.json()
      onAdded(created)
      setForm(EMPTY_FORM)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="border-b border-slate-100 pb-4">
          <SheetTitle className="text-base">Přidat nemovitost</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="px-4 py-4 flex flex-col gap-4">
          {/* Základní info */}
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Základní info</div>
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Název *</label>
              <Input
                required
                value={form.nazev}
                onChange={(e) => set("nazev", e.target.value)}
                placeholder="Byt 3+kk, Praha 6"
                className="h-8 text-[13px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Typ *</label>
                <Select value={form.typ} onValueChange={(v) => set("typ", v ?? "byt")}>
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="byt">Byt</SelectItem>
                    <SelectItem value="dum">Dům</SelectItem>
                    <SelectItem value="pozemek">Pozemek</SelectItem>
                    <SelectItem value="komercni">Komerční</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Stav *</label>
                <Select value={form.stav} onValueChange={(v) => set("stav", v ?? "aktivni")}>
                  <SelectTrigger className="h-8 text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aktivni">Aktivní</SelectItem>
                    <SelectItem value="rezervovano">Rezervováno</SelectItem>
                    <SelectItem value="prodano">Prodáno</SelectItem>
                    <SelectItem value="pripravuje_se">Připravuje se</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Lokalita *</label>
              <Input
                required
                value={form.lokalita}
                onChange={(e) => set("lokalita", e.target.value)}
                placeholder="Praha 6 - Dejvice"
                className="h-8 text-[13px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Cena (Kč) *</label>
                <Input
                  required
                  type="number"
                  value={form.cena}
                  onChange={(e) => set("cena", e.target.value)}
                  placeholder="5900000"
                  className="h-8 text-[13px]"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Koupeno za (Kč)</label>
                <Input
                  type="number"
                  value={form.koupenoZa}
                  onChange={(e) => set("koupenoZa", e.target.value)}
                  placeholder="4800000"
                  className="h-8 text-[13px]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Plocha (m²) *</label>
                <Input
                  required
                  type="number"
                  value={form.plocha}
                  onChange={(e) => set("plocha", e.target.value)}
                  placeholder="75"
                  className="h-8 text-[13px]"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Dispozice *</label>
                <Input
                  required
                  value={form.dispozice}
                  onChange={(e) => set("dispozice", e.target.value)}
                  placeholder="3+kk"
                  className="h-8 text-[13px]"
                />
              </div>
            </div>
          </div>

          {/* Majitel */}
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Majitel</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Jméno *</label>
                <Input
                  required
                  value={form.majitel}
                  onChange={(e) => set("majitel", e.target.value)}
                  placeholder="Jan Novák"
                  className="h-8 text-[13px]"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Kontakt *</label>
                <Input
                  required
                  value={form.majitelKontakt}
                  onChange={(e) => set("majitelKontakt", e.target.value)}
                  placeholder="+420 777 000 000"
                  className="h-8 text-[13px]"
                />
              </div>
            </div>
          </div>

          {/* Technické info */}
          <div className="flex flex-col gap-3">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Technické info</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Rok rekonstrukce</label>
                <Input
                  type="number"
                  value={form.rokRekonstrukce}
                  onChange={(e) => set("rokRekonstrukce", e.target.value)}
                  placeholder="2020"
                  className="h-8 text-[13px]"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Energetická třída</label>
                <Input
                  value={form.energetickaTrida}
                  onChange={(e) => set("energetickaTrida", e.target.value)}
                  placeholder="B"
                  className="h-8 text-[13px]"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Stavební úpravy</label>
              <Input
                value={form.stavebniUpravy}
                onChange={(e) => set("stavebniUpravy", e.target.value)}
                placeholder="Nová koupelna, podlahy"
                className="h-8 text-[13px]"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 mb-1 block">Datum nasazení *</label>
              <Input
                required
                type="date"
                value={form.datumNasazeni}
                onChange={(e) => set("datumNasazeni", e.target.value)}
                className="h-8 text-[13px]"
              />
            </div>
          </div>

          {/* Stav podkladů */}
          <div className="flex flex-col gap-2">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Stav podkladů</div>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.fotky}
                  onChange={(e) => set("fotky", e.target.checked)}
                  className="rounded"
                />
                <span className="text-[13px] text-slate-700">Fotografie</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.popisPopis}
                  onChange={(e) => set("popisPopis", e.target.checked)}
                  className="rounded"
                />
                <span className="text-[13px] text-slate-700">Popis</span>
              </label>
            </div>
          </div>

          {/* Poznámka */}
          <div>
            <label className="text-[11px] text-slate-500 mb-1 block">Poznámka</label>
            <textarea
              value={form.poznamka}
              onChange={(e) => set("poznamka", e.target.value)}
              placeholder="Volitelná poznámka…"
              rows={3}
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <SheetFooter className="border-t border-slate-100 pt-4 mt-0">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-emerald-500 text-white text-[13px] font-medium px-4 py-2 hover:bg-emerald-600 transition-colors disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {saving ? "Ukládám…" : "Přidat nemovitost"}
            </button>
            <SheetClose className="flex items-center justify-center rounded-lg border border-slate-200 text-slate-600 text-[13px] font-medium px-4 py-2 hover:bg-slate-50 transition-colors">
              Zrušit
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

// ──────────────────────────────────────────────
// MAIN PAGE
// ──────────────────────────────────────────────

export default function NemovitostiPage() {
  const [search, setSearch] = useState("")
  const [typFilter, setTypFilter] = useState("vse")
  const [stavFilter, setStavFilter] = useState("vse")
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => r.json())
      .then((data) => setProperties(Array.isArray(data) ? data : []))
      .catch(() => setProperties([]))
      .finally(() => setLoading(false))
  }, [])

  // Stats
  const stats = useMemo(() => {
    const total = properties.length
    const aktivni = properties.filter((p) => p.stav === "aktivni").length
    const prodanoRez = properties.filter(
      (p) => p.stav === "prodano" || p.stav === "rezervovano"
    ).length
    const neuplna = properties.filter(hasMissingData).length
    return { total, aktivni, prodanoRez, neuplna }
  }, [properties])

  // Filtered list
  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (typFilter !== "vse" && p.typ !== typFilter) return false
      if (stavFilter !== "vse" && p.stav !== stavFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!p.nazev.toLowerCase().includes(q) && !p.lokalita.toLowerCase().includes(q))
          return false
      }
      return true
    })
  }, [properties, typFilter, stavFilter, search])

  function handleAdded(p: Property) {
    setProperties((prev) => [p, ...prev])
  }

  function handleDeleted(id: string) {
    setProperties((prev) => prev.filter((p) => p.id !== id))
  }

  function handleUpdated(p: Property) {
    setProperties((prev) => prev.map((x) => x.id === p.id ? p : x))
    setSelectedProperty(p)
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 leading-tight">Nemovitosti</h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Přehled všech nemovitostí ve správě</p>
        </div>
        <Badge variant="secondary" className="ml-2 text-[11px]">
          {stats.total} celkem
        </Badge>
        <button
          onClick={() => setAddOpen(true)}
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-emerald-500 text-white text-[13px] font-medium px-3 py-1.5 hover:bg-emerald-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Přidat nemovitost
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Celkem", value: stats.total, color: "text-slate-700", bg: "bg-slate-50" },
          { label: "Aktivní", value: stats.aktivni, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Prodáno / Rez.", value: stats.prodanoRez, color: "text-slate-600", bg: "bg-slate-50" },
          { label: "Neúplná data", value: stats.neuplna, color: "text-amber-700", bg: "bg-amber-50" },
        ].map((s) => (
          <div
            key={s.label}
            className={cn(
              "rounded-xl border border-slate-200 px-4 py-3",
              s.bg
            )}
          >
            <div className={cn("text-2xl font-bold leading-none", s.color)}>{s.value}</div>
            <div className="text-[11px] text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Hledat nemovitost…"
            className="pl-8 h-8 text-[13px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={typFilter} onValueChange={(v) => { if (v) setTypFilter(v) }}>
          <SelectTrigger className="h-8 text-[13px] min-w-[120px]">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vse">Všechny typy</SelectItem>
            <SelectItem value="byt">Byt</SelectItem>
            <SelectItem value="dum">Dům</SelectItem>
            <SelectItem value="pozemek">Pozemek</SelectItem>
            <SelectItem value="komercni">Komerční</SelectItem>
          </SelectContent>
        </Select>

        <Select value={stavFilter} onValueChange={(v) => { if (v) setStavFilter(v) }}>
          <SelectTrigger className="h-8 text-[13px] min-w-[130px]">
            <SelectValue placeholder="Stav" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="vse">Všechny stavy</SelectItem>
            <SelectItem value="aktivni">Aktivní</SelectItem>
            <SelectItem value="rezervovano">Rezervováno</SelectItem>
            <SelectItem value="prodano">Prodáno</SelectItem>
            <SelectItem value="pripravuje_se">Připravuje se</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-[11px] text-slate-400 ml-auto">
          {filtered.length} / {stats.total}
        </span>
      </div>

      {/* Property grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-8 w-8 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin mb-3" />
          <p className="text-[13px] text-slate-400">Načítám nemovitosti...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-8 w-8 text-slate-300 mb-3" />
          <p className="text-[13px] text-slate-400">Žádné nemovitosti neodpovídají filtru</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              onClick={() => setSelectedProperty(property)}
            />
          ))}
        </div>
      )}

      {/* CTA */}
      <Link
        href="/agent"
        className="group flex items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 hover:bg-emerald-100 transition-colors mt-2"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
          <Bot className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1">
          <div className="text-[13px] font-semibold text-slate-800">Zeptat se Pepy na nemovitosti</div>
          <div className="text-[11px] text-slate-500">Audit dat, doporučení, reporty — vše přes chat</div>
        </div>
        <ArrowRight className="h-4 w-4 text-emerald-500 group-hover:translate-x-0.5 transition-transform" />
      </Link>

      {/* Detail sheet */}
      <PropertySheet
        property={selectedProperty}
        onClose={() => setSelectedProperty(null)}
        onDelete={handleDeleted}
        onUpdated={handleUpdated}
      />

      {/* Add property sheet */}
      <AddPropertySheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdded={handleAdded}
      />
    </div>
  )
}
