"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import {
  Banknote, Bot, Building2, Calendar, CheckSquare, FileText,
  LayoutDashboard, Lightbulb, Mail, MessageSquare, Radio,
  StickyNote, TrendingUp, Users, Menu, X, LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet"

// ── Nav items ─────────────────────────────────────────────────────────────────

const BASE_NAV = [
  { href: "/",            label: "Dashboard",          icon: LayoutDashboard, highlight: false, adminOnly: false },
  { href: "/agent",       label: "AI Agent",           icon: MessageSquare,   highlight: true,  adminOnly: false },
  { href: "/klienti",     label: "Klienti & Pipeline", icon: TrendingUp,      highlight: false, adminOnly: false },
  { href: "/nemovitosti", label: "Nemovitosti",         icon: Building2,       highlight: false, adminOnly: false },
  { href: "/trzby",       label: "Tržby",               icon: Banknote,        highlight: false, adminOnly: false },
  { href: "/kalendar",    label: "Kalendář",            icon: Calendar,        highlight: false, adminOnly: false },
  { href: "/emaily",      label: "Emaily",              icon: Mail,            highlight: false, adminOnly: false },
  { href: "/dokumenty",   label: "Dokumenty",           icon: FileText,        highlight: false, adminOnly: false },
  { href: "/poznamky",    label: "Poznámky",            icon: StickyNote,      highlight: false, adminOnly: false },
  { href: "/poradce",     label: "AI Poradce",          icon: Lightbulb,       highlight: false, adminOnly: false },
  { href: "/monitoring",  label: "Monitoring",          icon: Radio,           highlight: false, adminOnly: false },
  { href: "/moje-ukoly",  label: "Moje úkoly",          icon: CheckSquare,     highlight: false, adminOnly: false },
  { href: "/tym",         label: "Správa týmu",         icon: Users,           highlight: false, adminOnly: true  },
]

// ── NavLinks ──────────────────────────────────────────────────────────────────

function NavLinks({ pathname, isAdmin, newTaskCount, onNavigate }: {
  pathname: string; isAdmin: boolean; newTaskCount: number; onNavigate?: () => void
}) {
  const items = BASE_NAV.filter(i => !i.adminOnly || isAdmin)

  return (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {items.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon
        const showBadge = item.href === "/moje-ukoly" && newTaskCount > 0

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
              isActive
                ? "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20"
                : item.highlight
                ? "text-slate-300 hover:bg-slate-800/70 hover:text-white"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0 transition-colors",
              isActive ? "text-emerald-400" : item.highlight ? "text-slate-300 group-hover:text-white" : "text-slate-500 group-hover:text-slate-300"
            )} />
            <span>{item.label}</span>
            {item.highlight && !isActive && (
              <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-400 ring-1 ring-emerald-500/30">AI</span>
            )}
            {showBadge && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
                {newTaskCount}
              </span>
            )}
            {isActive && !item.highlight && !showBadge && (
              <div className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}

// ── UserProfile ───────────────────────────────────────────────────────────────

function UserProfile() {
  const { data: session } = useSession()
  const user = session?.user as Record<string, unknown> | undefined
  const jmeno   = (user?.jmeno   as string | undefined) ?? "Uživatel"
  const prijmeni = (user?.prijmeni as string | undefined) ?? ""
  const pozice  = (user?.pozice  as string | undefined) ?? ""
  const initials = `${jmeno[0] ?? ""}${prijmeni[0] ?? ""}`.toUpperCase()

  return (
    <div className="border-t border-slate-800/60 p-4 space-y-3">
      <a
        href="/api/auth/google"
        className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-[11px] font-medium text-slate-400 border border-slate-700/60 hover:border-slate-600 hover:text-slate-200 hover:bg-slate-800/50 transition-all duration-150"
      >
        <Mail className="h-3.5 w-3.5 shrink-0 text-red-400" />
        <span className="flex-1 truncate">Propojit Google / Gmail</span>
      </a>
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-bold text-white shadow-sm">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-slate-200">{jmeno} {prijmeni}</div>
          <div className="truncate text-[11px] text-slate-500">{pozice}</div>
        </div>
        <button onClick={() => signOut({ callbackUrl: "/login" })} title="Odhlásit se"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex h-16 items-center gap-3 px-6 border-b border-slate-800/60">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
        <Bot className="h-4 w-4 text-emerald-400" />
      </div>
      <div>
        <div className="text-sm font-semibold text-white tracking-tight">Pepa 2.0</div>
        <div className="text-[10px] font-medium text-slate-500 uppercase tracking-widest leading-none mt-0.5">AI Back Office Agent</div>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [newTaskCount, setNewTaskCount] = useState(0)
  const { data: session } = useSession()
  const isAdmin = (session?.user as Record<string, unknown> | undefined)?.role === "admin"

  useEffect(() => {
    if (!session) return
    fetch("/api/tasks?status=novy")
      .then(r => r.ok ? r.json() : [])
      .then((tasks: unknown[]) => setNewTaskCount(Array.isArray(tasks) ? tasks.length : 0))
      .catch(() => {})
  }, [session])

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-64 flex-col bg-slate-950 border-r border-slate-800/60">
        <Logo />
        <NavLinks pathname={pathname} isAdmin={isAdmin} newTaskCount={newTaskCount} />
        <UserProfile />
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-slate-950 border-b border-slate-800/60 flex items-center gap-3 px-4">
        <button onClick={() => setMobileOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors" aria-label="Otevřít menu">
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 flex-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
            <Bot className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <span className="text-sm font-semibold text-white">Pepa 2.0</span>
        </div>
        {newTaskCount > 0 && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">{newTaskCount}</span>
        )}
      </div>

      {/* ── Mobile drawer ── */}
      <Sheet open={mobileOpen} onOpenChange={(open) => setMobileOpen(open)}>
        <SheetContent side="left" showCloseButton={false} className="w-64 p-0 bg-slate-950 border-r border-slate-800/60 flex flex-col">
          <div className="flex items-center justify-between pr-3">
            <Logo />
            <SheetClose className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors shrink-0">
              <X className="h-4 w-4" />
            </SheetClose>
          </div>
          <NavLinks pathname={pathname} isAdmin={isAdmin} newTaskCount={newTaskCount} onNavigate={() => setMobileOpen(false)} />
          <UserProfile />
        </SheetContent>
      </Sheet>
    </>
  )
}
