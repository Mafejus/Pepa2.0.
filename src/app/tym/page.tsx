"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Users, Plus, Edit2, Trash2, RefreshCw, CheckCircle2,
  Clock, AlertTriangle, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/toast"

// ── Types ──────────────────────────────────────────────────────────────────────

interface User {
  id: string; email: string; jmeno: string; prijmeni: string
  role: string; pozice: string | null; telefon: string | null; aktivni: boolean
}
interface Task {
  id: string; title: string; description: string; status: string; priority: string
  type: string; assignedToId: string; createdById: string; dueDate: string | null
  assignedTo: { id: string; jmeno: string; prijmeni: string; pozice: string | null }
  createdBy:  { id: string; jmeno: string; prijmeni: string }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POZICE_OPTIONS = ["Back Office Manager","Obchodní makléř","Obchodní makléřka","Asistent","Asistentka","Koordinátor"]
const TASK_TYPES     = [
  { value: "obecny",         label: "Obecný" },
  { value: "prohlidka",      label: "Prohlídka" },
  { value: "hledani",        label: "Hledání nemovitosti" },
  { value: "kontakt",        label: "Kontaktování klienta" },
  { value: "pronajem",       label: "Pronájem" },
  { value: "prodej",         label: "Prodej" },
  { value: "administrativa", label: "Administrativa" },
]
const PRIORITIES = [
  { value: "low",    label: "Nízká",   color: "bg-slate-100 text-slate-600" },
  { value: "normal", label: "Normální",color: "bg-blue-50 text-blue-700" },
  { value: "high",   label: "Vysoká",  color: "bg-amber-50 text-amber-700" },
  { value: "urgent", label: "Urgentní",color: "bg-red-50 text-red-700" },
]
const STATUSES = [
  { value: "novy",          label: "Nový",          color: "bg-slate-100 text-slate-700" },
  { value: "rozpracovany",  label: "Rozpracovaný",  color: "bg-blue-50 text-blue-700" },
  { value: "hotovo",        label: "Hotovo",         color: "bg-emerald-50 text-emerald-700" },
  { value: "zruseno",       label: "Zrušeno",        color: "bg-red-50 text-red-700" },
]

function priorityBadge(p: string) { return PRIORITIES.find(x => x.value === p) ?? PRIORITIES[1] }
function statusBadge(s: string)   { return STATUSES.find(x => x.value === s) ?? STATUSES[0] }
function typLabel(t: string)      { return TASK_TYPES.find(x => x.value === t)?.label ?? t }

// ── User Dialog ───────────────────────────────────────────────────────────────

const EMPTY_USER_FORM = { email:"", password:"", jmeno:"", prijmeni:"", telefon:"", pozice:"", role:"zamestnanec" }

function UserDialog({ open, onClose, editUser, onSaved }: {
  open: boolean; onClose: () => void; editUser: User | null; onSaved: () => void
}) {
  const [form, setForm] = useState(EMPTY_USER_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editUser) setForm({ ...EMPTY_USER_FORM, ...editUser, password: "", telefon: editUser.telefon ?? "", pozice: editUser.pozice ?? "" })
    else setForm(EMPTY_USER_FORM)
  }, [editUser, open])

  if (!open) return null

  async function save() {
    setSaving(true)
    try {
      const method = editUser ? "PATCH" : "POST"
      const url    = editUser ? `/api/users/${editUser.id}` : "/api/users"
      const body   = editUser ? { ...form, password: form.password || undefined } : form
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(await res.text())
      toast(editUser ? "Uživatel aktualizován" : "Uživatel vytvořen")
      onSaved(); onClose()
    } catch { toast("Chyba při ukládání") }
    finally { setSaving(false) }
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-base font-semibold text-slate-800 mb-5">{editUser ? "Editovat člena" : "Přidat člena týmu"}</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Jméno" value={form.jmeno} onChange={v => set("jmeno", v)} />
            <Field label="Příjmení" value={form.prijmeni} onChange={v => set("prijmeni", v)} />
          </div>
          <Field label="Email" type="email" value={form.email} onChange={v => set("email", v)} />
          <Field label={editUser ? "Nové heslo (ponech prázdné)" : "Heslo"} type="password" value={form.password} onChange={v => set("password", v)} />
          <Field label="Telefon" value={form.telefon} onChange={v => set("telefon", v)} />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Pozice</label>
            <select className={inputCls} value={form.pozice} onChange={e => set("pozice", e.target.value)}>
              <option value="">— vyberte —</option>
              {POZICE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
            <select className={inputCls} value={form.role} onChange={e => set("role", e.target.value)}>
              <option value="zamestnanec">Zaměstnanec</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Zrušit</button>
          <button onClick={save} disabled={saving} className="flex-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white">
            {saving ? "Ukládám…" : "Uložit"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Task Dialog ───────────────────────────────────────────────────────────────

const EMPTY_TASK_FORM = { title:"", description:"", assignedToId:"", type:"obecny", priority:"normal", dueDate:"" }

function TaskDialog({ open, onClose, users, editTask, onSaved }: {
  open: boolean; onClose: () => void; users: User[]; editTask: Task | null; onSaved: () => void
}) {
  const [form, setForm] = useState(EMPTY_TASK_FORM)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editTask) setForm({ title: editTask.title, description: editTask.description, assignedToId: editTask.assignedToId, type: editTask.type, priority: editTask.priority, dueDate: editTask.dueDate ? editTask.dueDate.slice(0,10) : "" })
    else setForm(EMPTY_TASK_FORM)
  }, [editTask, open])

  if (!open) return null

  async function save() {
    setSaving(true)
    try {
      const method = editTask ? "PATCH" : "POST"
      const url    = editTask ? `/api/tasks/${editTask.id}` : "/api/tasks"
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, dueDate: form.dueDate || null }) })
      if (!res.ok) throw new Error(await res.text())
      toast(editTask ? "Úkol aktualizován" : "Úkol přiřazen")
      onSaved(); onClose()
    } catch { toast("Chyba při ukládání") }
    finally { setSaving(false) }
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-semibold text-slate-800 mb-5">{editTask ? "Editovat úkol" : "Nový úkol"}</h3>
        <div className="space-y-3">
          <Field label="Název úkolu" value={form.title} onChange={v => set("title", v)} />
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Popis</label>
            <textarea className={cn(inputCls, "min-h-[80px] resize-y")} value={form.description} onChange={e => set("description", e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Přiřadit komu</label>
            <select className={inputCls} value={form.assignedToId} onChange={e => set("assignedToId", e.target.value)}>
              <option value="">— vyberte —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.jmeno} {u.prijmeni}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Typ</label>
              <select className={inputCls} value={form.type} onChange={e => set("type", e.target.value)}>
                {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Priorita</label>
              <select className={inputCls} value={form.priority} onChange={e => set("priority", e.target.value)}>
                {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <Field label="Termín splnění (volitelný)" type="date" value={form.dueDate} onChange={v => set("dueDate", v)} />
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Zrušit</button>
          <button onClick={save} disabled={saving || !form.title || !form.assignedToId} className="flex-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white">
            {saving ? "Ukládám…" : "Uložit"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <input type={type} className={inputCls} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TymPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers]         = useState<User[]>([])
  const [tasks, setTasks]         = useState<Task[]>([])
  const [loading, setLoading]     = useState(true)
  const [userDialog, setUserDialog] = useState(false)
  const [taskDialog, setTaskDialog] = useState(false)
  const [editUser, setEditUser]   = useState<User | null>(null)
  const [editTask, setEditTask]   = useState<Task | null>(null)
  const [filterUser, setFilterUser] = useState("")
  const [filterStatus, setFilterStatus] = useState("vse")

  const isAdmin = (session?.user as Record<string, unknown> | undefined)?.role === "admin"

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated" && !isAdmin) router.push("/")
  }, [status, isAdmin, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [uRes, tRes] = await Promise.all([fetch("/api/users"), fetch("/api/tasks")])
      if (uRes.ok) setUsers(await uRes.json())
      if (tRes.ok) setTasks(await tRes.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (isAdmin) load() }, [isAdmin, load])

  if (status === "loading" || loading) return <div className="flex items-center justify-center min-h-[40vh]"><RefreshCw className="h-6 w-6 animate-spin text-slate-400" /></div>
  if (!isAdmin) return null

  const filteredTasks = tasks.filter(t => {
    if (filterUser && t.assignedToId !== filterUser) return false
    if (filterStatus !== "vse" && t.status !== filterStatus) return false
    return true
  })

  async function toggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aktivni: !user.aktivni }) })
    toast(`${user.jmeno} ${user.aktivni ? "deaktivován" : "aktivován"}`)
    load()
  }

  async function deleteTask(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" })
    toast("Úkol smazán")
    load()
  }

  async function changeTaskStatus(id: string, status: string) {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) })
    load()
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <Users className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Správa týmu</h1>
            <p className="text-xs text-slate-500">{users.length} členů · {tasks.filter(t => t.status !== "hotovo").length} aktivních úkolů</p>
          </div>
        </div>
        <button onClick={() => { setEditUser(null); setUserDialog(true) }}
          className="flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
          <Plus className="h-4 w-4" /> Přidat člena
        </button>
      </div>

      {/* Users table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">Členové týmu</div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-5 py-3 text-left">Jméno</th>
            <th className="px-5 py-3 text-left hidden md:table-cell">Email</th>
            <th className="px-5 py-3 text-left hidden lg:table-cell">Pozice</th>
            <th className="px-5 py-3 text-left">Role</th>
            <th className="px-5 py-3 text-left">Aktivní</th>
            <th className="px-5 py-3 text-right">Akce</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-50">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-[11px] font-bold text-white">
                      {u.jmeno[0]}{u.prijmeni[0]}
                    </div>
                    <span className="font-medium text-slate-800">{u.jmeno} {u.prijmeni}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-500 hidden md:table-cell">{u.email}</td>
                <td className="px-5 py-3 text-slate-500 hidden lg:table-cell">{u.pozice ?? "—"}</td>
                <td className="px-5 py-3">
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", u.role === "admin" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700")}>
                    {u.role === "admin" ? "Admin" : "Zaměstnanec"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <button onClick={() => toggleActive(u)}
                    className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors", u.aktivni ? "bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:text-red-700" : "bg-red-50 text-red-700 hover:bg-emerald-50 hover:text-emerald-700")}>
                    {u.aktivni ? "Aktivní" : "Neaktivní"}
                  </button>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { setEditUser(u); setUserDialog(true) }} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                    <button onClick={() => { toast("Heslo resetováno (mock)") }} className="rounded-lg p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"><RefreshCw className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tasks section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">Přiřazení úkolů</h2>
          <button onClick={() => { setEditTask(null); setTaskDialog(true) }}
            className="flex items-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-700 px-3 py-2 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" /> Nový úkol
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <select className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 bg-white" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="">Všichni zaměstnanci</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.jmeno} {u.prijmeni}</option>)}
          </select>
          <select className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 bg-white" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="vse">Vše</option>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {/* Tasks table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 text-left">Název</th>
              <th className="px-5 py-3 text-left hidden md:table-cell">Přiřazeno</th>
              <th className="px-5 py-3 text-left">Priorita</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-left hidden lg:table-cell">Termín</th>
              <th className="px-5 py-3 text-right">Akce</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-50">
              {filteredTasks.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400 text-sm">Žádné úkoly</td></tr>
              )}
              {filteredTasks.map(t => {
                const pb = priorityBadge(t.priority)
                const sb = statusBadge(t.status)
                const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "hotovo"
                return (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-800 leading-snug">{t.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{typLabel(t.type)}</div>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 shrink-0 flex items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-[9px] font-bold text-white">
                          {t.assignedTo.jmeno[0]}{t.assignedTo.prijmeni[0]}
                        </div>
                        <span className="text-slate-600">{t.assignedTo.jmeno} {t.assignedTo.prijmeni}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", pb.color)}>{pb.label}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="relative group inline-block">
                        <button className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", sb.color)}>
                          {sb.label} <ChevronDown className="h-2.5 w-2.5" />
                        </button>
                        <div className="absolute left-0 top-full mt-1 z-10 hidden group-hover:flex flex-col bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[130px]">
                          {STATUSES.map(s => (
                            <button key={s.value} onClick={() => changeTaskStatus(t.id, s.value)}
                              className="px-3 py-1.5 text-left text-xs hover:bg-slate-50 text-slate-700 whitespace-nowrap">
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      {t.dueDate ? (
                        <span className={cn("text-xs", isOverdue ? "text-red-500 font-semibold" : "text-slate-500")}>
                          {isOverdue && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                          {new Date(t.dueDate).toLocaleDateString("cs-CZ")}
                        </span>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => { setEditTask(t); setTaskDialog(true) }} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100"><Edit2 className="h-3.5 w-3.5" /></button>
                        {t.status !== "hotovo" && <button onClick={() => changeTaskStatus(t.id, "hotovo")} className="rounded-lg p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                        <button onClick={() => deleteTask(t.id)} className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <UserDialog open={userDialog} onClose={() => setUserDialog(false)} editUser={editUser} onSaved={load} />
      <TaskDialog open={taskDialog} onClose={() => setTaskDialog(false)} users={users} editTask={editTask} onSaved={load} />
    </div>
  )
}
