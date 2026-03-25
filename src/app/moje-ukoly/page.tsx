"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { CheckSquare, RefreshCw, Clock, AlertTriangle, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "@/lib/toast"

interface Task {
  id: string; title: string; description: string; status: string; priority: string
  type: string; dueDate: string | null
  createdBy: { id: string; jmeno: string; prijmeni: string }
}

const PRIORITIES = [
  { value: "low",    label: "Nízká",    color: "bg-slate-100 text-slate-600" },
  { value: "normal", label: "Normální", color: "bg-blue-50 text-blue-700" },
  { value: "high",   label: "Vysoká",   color: "bg-amber-50 text-amber-700" },
  { value: "urgent", label: "Urgentní", color: "bg-red-50 text-red-700" },
]
const TASK_TYPES = [
  { value: "obecny",         label: "Obecný",       color: "bg-slate-100 text-slate-600" },
  { value: "prohlidka",      label: "Prohlídka",    color: "bg-blue-50 text-blue-700" },
  { value: "hledani",        label: "Hledání",      color: "bg-violet-50 text-violet-700" },
  { value: "kontakt",        label: "Kontakt",      color: "bg-emerald-50 text-emerald-700" },
  { value: "pronajem",       label: "Pronájem",     color: "bg-orange-50 text-orange-700" },
  { value: "prodej",         label: "Prodej",       color: "bg-pink-50 text-pink-700" },
  { value: "administrativa", label: "Admin",        color: "bg-slate-100 text-slate-600" },
]

function priorityBadge(p: string) { return PRIORITIES.find(x => x.value === p) ?? PRIORITIES[1] }
function typBadge(t: string)      { return TASK_TYPES.find(x => x.value === t) ?? TASK_TYPES[0] }

const COLUMNS = [
  { key: "novy",         label: "Nové",          next: "rozpracovany", color: "border-slate-300 bg-slate-50" },
  { key: "rozpracovany", label: "Rozpracované",  next: "hotovo",       color: "border-blue-200 bg-blue-50/30" },
  { key: "hotovo",       label: "Hotové",        next: null,           color: "border-emerald-200 bg-emerald-50/30" },
]

function TaskCard({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, status: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pb = priorityBadge(task.priority)
  const tb = typBadge(task.type)
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "hotovo"
  const col = COLUMNS.find(c => c.key === task.status)

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className={cn("h-1", task.priority === "urgent" ? "bg-red-400" : task.priority === "high" ? "bg-amber-400" : task.priority === "normal" ? "bg-blue-400" : "bg-slate-200")} />
      <div className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-800 leading-snug line-clamp-2">{task.title}</p>
            {task.description && <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{task.description}</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mb-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", pb.color)}>{pb.label}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", tb.color)}>{tb.label}</span>
        </div>

        {task.dueDate && (
          <div className={cn("flex items-center gap-1 text-[11px] mb-2", isOverdue ? "text-red-500 font-semibold" : "text-slate-400")}>
            {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {new Date(task.dueDate).toLocaleDateString("cs-CZ")}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-50 pt-2 mt-2">
          <span className="text-[11px] text-slate-400">od: {task.createdBy.jmeno} {task.createdBy.prijmeni}</span>
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)} className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border", task.status === "novy" ? "bg-slate-100 text-slate-600 border-slate-200" : task.status === "rozpracovany" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-emerald-50 text-emerald-700 border-emerald-200")}>
              {task.status === "novy" ? "Nový" : task.status === "rozpracovany" ? "Pracuji" : "Hotovo"}
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 bottom-full mb-1 z-10 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden min-w-[140px]">
                {col?.next && (
                  <button onClick={() => { onStatusChange(task.id, col.next!); setMenuOpen(false) }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50">
                    → {col.next === "rozpracovany" ? "Označit jako pracuji" : "Označit jako hotovo"}
                  </button>
                )}
                {task.status !== "novy" && (
                  <button onClick={() => { onStatusChange(task.id, "novy"); setMenuOpen(false) }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50">
                    ← Vrátit na nový
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MojeUkolyPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tasks, setTasks]     = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
  }, [status, router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/tasks")
      if (res.ok) setTasks(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (status === "authenticated") load() }, [status, load])

  const handleStatusChange = useCallback(async (id: string, newStatus: string) => {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) })
    toast(newStatus === "hotovo" ? "Úkol splněn! 🎉" : "Status aktualizován")
    load()
  }, [load])

  if (status === "loading" || loading) return <div className="flex items-center justify-center min-h-[40vh]"><RefreshCw className="h-6 w-6 animate-spin text-slate-400" /></div>

  const newCount = tasks.filter(t => t.status === "novy").length

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
          <CheckSquare className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Moje úkoly</h1>
          <p className="text-xs text-slate-500">
            {newCount > 0 ? `${newCount} nových úkolů` : "Žádné nové úkoly"} · celkem {tasks.length}
          </p>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.key)
          return (
            <div key={col.key} className={cn("rounded-xl border p-4", col.color)}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-600 shadow-sm">
                  {colTasks.length}
                </span>
              </div>
              <div className="space-y-3">
                {colTasks.length === 0 && (
                  <p className="text-[12px] text-slate-400 text-center py-6">Žádné úkoly</p>
                )}
                {colTasks.map(t => (
                  <TaskCard key={t.id} task={t} onStatusChange={handleStatusChange} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
