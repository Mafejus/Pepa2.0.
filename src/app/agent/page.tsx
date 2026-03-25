"use client"

import { useRef, useEffect, useMemo, useState, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai"
import {
  Bot,
  Send,
  User,
  Loader2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Paperclip,
  X,
  FileText,
  Mail,
  Calendar,
  Flame,
  ChevronRight,
  Sparkles,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { ToolResultRenderer } from "@/components/chat/tool-result-renderer"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────
// QUICK ACTIONS
// ──────────────────────────────────────────────
const QUICK_ACTIONS = [
  {
    icon: "🌅",
    title: "Ranní briefing",
    desc: "Dnešní kalendář + nové emaily",
    prompt: "Připrav mi ranní briefing: co mám dnes v kalendáři a jaké nové emaily jsem dostal?",
  },
  {
    icon: "✉️",
    title: "Email pro zájemce",
    desc: "Návrh emailu s termíny prohlídky",
    prompt:
      "Napiš e-mail pro zájemce o nemovitost Byt 3+kk Holešovice a doporuč mu termín prohlídky na základě mé dostupnosti v kalendáři.",
  },
  {
    icon: "📊",
    title: "Analýza klientů Q1",
    desc: "Přehled nových klientů s grafem zdrojů",
    prompt: "Jaké nové klienty máme za 1. kvartál? Odkud přišli? Znázorni graficky.",
  },
  {
    icon: "📈",
    title: "Graf leadů a prodejů",
    desc: "Vývoj za posledních 6 měsíců",
    prompt: "Vytvoř graf vývoje počtu leadů a prodaných nemovitostí za posledních 6 měsíců.",
  },
  {
    icon: "📝",
    title: "Přidej úkoly na dnes",
    desc: "Zapsat prioritní úkoly",
    prompt: "Přidej mi do úkolů: 1) Zavolat klientovi Novákovi ohledně prohlídky, 2) Doplnit fotky k nemovitosti Holešovice 3+kk, 3) Připravit smlouvu pro prodej Praha 7.",
  },
  {
    icon: "🔍",
    title: "Audit nemovitostí",
    desc: "Chybějící data o rekonstrukcích",
    prompt:
      "Najdi nemovitosti, u kterých nám v systému chybí data o rekonstrukci a stavebních úpravách a připrav jejich seznam k doplnění.",
  },
  {
    icon: "📋",
    title: "Report pro vedení",
    desc: "Shrnutí minulého týdne + 3 slidy",
    prompt:
      "Shrň výsledky minulého týdne do krátkého reportu pro vedení a připrav k tomu prezentaci se třemi slidy.",
  },
  {
    icon: "🔎",
    title: "Hledej na trhu",
    desc: "Nabídky z realitních serverů",
    prompt: "Najdi mi zajímavé byty k prodeji v Praze do 8 milionů korun. Porovnej ceny a doporuč nejlepší nabídky.",
  },
  {
    icon: "🏠",
    title: "Monitoring Holešovice",
    desc: "Nové nabídky z portálů",
    prompt: "Sleduj všechny hlavní realitní servery a informuj mě o nových nabídkách v lokalitě Praha Holešovice.",
  },
  {
    icon: "🏡",
    title: "Najdi byt s terasou",
    desc: "Byty s terasou nebo balkonem",
    prompt: "Najdi mi byt v Praze s terasou nebo balkonem do 8 milionů korun.",
  },
  {
    icon: "🔥",
    title: "Slevy na trhu",
    desc: "Zlevněné nemovitosti",
    prompt: "Najdi zlevněné nemovitosti v Praze. Které mají největší slevu?",
  },
  {
    icon: "📊",
    title: "Analýza trhu Praha",
    desc: "Průměrné ceny, trendy, doporučení",
    prompt: "Udělej kompletní analýzu realitního trhu v Praze — průměrné ceny, trendy, doporučení.",
  },
  {
    icon: "💡",
    title: "Co koupit?",
    desc: "AI investiční doporučení",
    prompt: "Doporuč mi zajímavé nemovitosti ke koupi jako investici v Praze.",
  },
  {
    icon: "📰",
    title: "Novinky z trhu",
    desc: "Aktuální zprávy z realit",
    prompt: "Jaké jsou aktuální zprávy z českého realitního trhu?",
  },
  {
    icon: "📄",
    title: "Najdi smlouvu",
    desc: "Prohledá interní dokumenty",
    prompt: "Najdi v dokumentech kupní smlouvu pro nemovitost v Holešovicích.",
  },
]

// ──────────────────────────────────────────────
// TOOL LABELS
// ──────────────────────────────────────────────
const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  queryClients:     { label: "Prohledávám klienty…",     icon: "👥" },
  queryProperties:  { label: "Prohledávám nemovitosti…",  icon: "🏠" },
  queryLeads:       { label: "Prohledávám leady…",        icon: "🎯" },
  querySales:       { label: "Prohledávám prodeje…",      icon: "💰" },
  queryCalendar:    { label: "Čtu kalendář…",             icon: "📅" },
  getCalendar:      { label: "Čtu kalendář…",             icon: "📅" },
  queryMonitoring:  { label: "Kontroluji monitoring…",    icon: "📡" },
  getMonitoring:    { label: "Kontroluji monitoring…",    icon: "📡" },
  generateChart:    { label: "Generuji graf…",             icon: "📊" },
  draftEmail:       { label: "Píšu email…",               icon: "✉️" },
  generateReport:   { label: "Připravuji report…",        icon: "📋" },
  readEmails:       { label: "Čtu emaily…",               icon: "📬" },
  sendGmail:        { label: "Odesílám email…",           icon: "📤" },
  createNote:       { label: "Vytvářím poznámku…",        icon: "📝" },
  getNotes:         { label: "Načítám poznámky…",         icon: "📋" },
  analyzeUpload:    { label: "Analyzuji soubor…",         icon: "📂" },
  searchRealEstate: { label: "Hledám nemovitosti na trhu…", icon: "🔎" },
  searchDocuments:  { label: "Prohledávám dokumenty…",    icon: "📄" },
  readDocument:     { label: "Čtu dokument…",              icon: "📖" },
  getAdvisory:      { label: "Připravuji doporučení…",     icon: "💡" },
  findDiscounts:    { label: "Hledám slevy na trhu…",      icon: "🔥" },
  analyzeMarket:    { label: "Analyzuji trh…",             icon: "📊" },
  getMarketNews:    { label: "Načítám zprávy z trhu…",     icon: "📰" },
}

// ──────────────────────────────────────────────
// PERSISTENCE
// ──────────────────────────────────────────────
const STORAGE_KEY = "pepa-chat-messages"
const MORNING_BRIEF_KEY = "pepa-morning-brief-shown"

function loadMessages(): UIMessage[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as UIMessage[]) : []
  } catch {
    return []
  }
}

function isMorningBriefDue(): boolean {
  if (typeof window === "undefined") return false
  const hour = new Date().getHours()
  if (hour < 6 || hour >= 14) return false // Only 6:00–14:00
  const today = new Date().toISOString().slice(0, 10)
  const lastShown = localStorage.getItem(MORNING_BRIEF_KEY)
  return lastShown !== today
}

function markMorningBriefShown() {
  const today = new Date().toISOString().slice(0, 10)
  localStorage.setItem(MORNING_BRIEF_KEY, today)
}

// ──────────────────────────────────────────────
// MORNING BRIEF CARD
// ──────────────────────────────────────────────
type MorningBriefData = {
  greeting: string
  neprecteneCount: number
  events: Array<{ id: string; nazev: string; typ: string; zacatek: string; lokace: string | null }>
  discountedCount: number
  discounted: Array<{ nazev: string; cena: number; lokalita: string; url: string }>
  emails: Array<{ id: string; od: string; predmet: string }>
}

function MorningBriefCard({
  data,
  onAction,
  onDismiss,
}: {
  data: MorningBriefData
  onAction: (prompt: string) => void
  onDismiss: () => void
}) {
  const hour = new Date().getHours()
  const greetingIcon = hour < 10 ? "🌅" : "☀️"

  const items: Array<{ icon: React.ReactNode; text: string; prompt: string }> = []

  if (data.neprecteneCount > 0) {
    items.push({
      icon: <Mail className="h-3.5 w-3.5 text-violet-500" />,
      text: `${data.neprecteneCount} nepřečtených emailů${data.emails[0] ? ` — ${data.emails[0].predmet}` : ""}`,
      prompt: "Přečti mi nepřečtené emaily a shrň co je důležité.",
    })
  }

  if (data.events.length > 0) {
    const first = data.events[0]
    const cas = new Date(first.zacatek).toLocaleTimeString("cs-CZ", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Prague",
    })
    const eventText =
      data.events.length === 1
        ? `${first.nazev} v ${cas}`
        : `${data.events.length} událostí — první: ${first.nazev} v ${cas}`
    items.push({
      icon: <Calendar className="h-3.5 w-3.5 text-blue-500" />,
      text: eventText,
      prompt: "Co mám dnes v kalendáři? Připrav mi přehled dnešních událostí.",
    })
  }

  if (data.discountedCount > 0) {
    items.push({
      icon: <Flame className="h-3.5 w-3.5 text-orange-500" />,
      text: `${data.discountedCount} nových zlevněných nemovitostí na Sreality`,
      prompt: "Najdi mi zlevněné nemovitosti v Praze a analyzuj je.",
    })
  }

  return (
    <div className="mx-auto w-full max-w-xl animate-fade-in-up">
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-emerald-100/80">
          <span className="text-[22px] leading-none">{greetingIcon}</span>
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-slate-800">
              {data.greeting}! Tady je tvůj přehled dne.
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Klikni na položku pro rychlou akci</p>
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-300 hover:text-slate-500 transition-colors"
            title="Zavřít"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Items */}
        {items.length > 0 ? (
          <div className="divide-y divide-slate-100/70">
            {items.map((item, i) => (
              <button
                key={i}
                onClick={() => { onAction(item.prompt); onDismiss() }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-emerald-50/60 transition-colors group"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-100 shadow-sm">
                  {item.icon}
                </div>
                <span className="flex-1 text-[12px] text-slate-700 leading-snug">{item.text}</span>
                <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-emerald-500 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <p className="px-4 py-3 text-[12px] text-slate-500">Žádné naléhavé novinky. Hezký den!</p>
        )}

        {/* CTA */}
        <div className="flex gap-2 px-4 py-3 border-t border-emerald-100/80 bg-emerald-50/40">
          <button
            onClick={() => {
              onAction(
                "Připrav mi kompletní ranní briefing: nepřečtené emaily, dnešní kalendář a nové slevy na Sreality. Shrň vše přehledně."
              )
              onDismiss()
            }}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500 text-white text-[12px] font-medium px-3 py-2 hover:bg-emerald-600 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Shrň vše dohromady
          </button>
          <button
            onClick={onDismiss}
            className="flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 text-[12px] font-medium px-3 py-2 hover:bg-slate-50 transition-colors"
          >
            Přeskočit
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// SIMPLE MARKDOWN RENDERER
// ──────────────────────────────────────────────
function RenderText({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="font-semibold text-slate-800">
              {line.slice(2, -2)}
            </p>
          )
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex items-start gap-1.5">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              <span>{line.slice(2)}</span>
            </div>
          )
        }
        if (line.match(/^\d+\. /)) {
          const num = line.match(/^(\d+)\. /)![1]
          return (
            <div key={i} className="flex items-start gap-1.5">
              <span className="shrink-0 font-metric text-[11px] font-semibold text-slate-400 mt-0.5">
                {num}.
              </span>
              <span>{line.replace(/^\d+\. /, "")}</span>
            </div>
          )
        }
        if (line === "") return <div key={i} className="h-1" />
        const boldParts = line.split(/(\*\*[^*]+\*\*)/)
        if (boldParts.length > 1) {
          return (
            <p key={i}>
              {boldParts.map((part, j) =>
                part.startsWith("**") && part.endsWith("**") ? (
                  <strong key={j}>{part.slice(2, -2)}</strong>
                ) : (
                  <span key={j}>{part}</span>
                )
              )}
            </p>
          )
        }
        return <p key={i}>{line}</p>
      })}
    </div>
  )
}

// ──────────────────────────────────────────────
// WELCOME SCREEN
// ──────────────────────────────────────────────
function WelcomeScreen({ onAction }: { onAction: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-6 px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-2 ring-emerald-500/20 mb-5 animate-pulse">
        <Bot className="h-8 w-8 text-emerald-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-800">Ahoj, jsem Pepa 2.0</h2>
      <p className="text-[13px] text-slate-400 mt-2 max-w-md text-center leading-relaxed">
        Tvůj AI asistent pro back-office operace. Zeptej se mě na cokoliv o klientech,
        nemovitostech, kalendáři nebo prodejích.
      </p>

      {/* Quick action grid */}
      <div className="mt-6 w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {QUICK_ACTIONS.map((action, i) => (
          <button
            key={action.title}
            onClick={() => onAction(action.prompt)}
            className="animate-fade-in-up text-left rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40 hover:shadow-sm active:scale-[0.98] transition-all duration-150 px-3 py-3"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start gap-2.5">
              <span className="text-[20px] leading-none mt-0.5 shrink-0">{action.icon}</span>
              <div>
                <div className="text-[12px] font-semibold text-slate-800 leading-tight">
                  {action.title}
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  {action.desc}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// THINKING INDICATOR
// ──────────────────────────────────────────────
function ThinkingIndicator({ activeToolName }: { activeToolName: string | null }) {
  const toolInfo = activeToolName
    ? (TOOL_LABELS[activeToolName] ?? { label: "Zpracovávám…", icon: "⚙️" })
    : null

  return (
    <div className="flex items-start gap-3 msg-in-left">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30 text-[11px] font-bold">
        P
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-4 py-2.5 flex items-center gap-2">
          <span className="text-[12px] text-slate-500">Pepa přemýšlí</span>
          <span className="flex gap-0.5 items-center ml-0.5">
            <span className="dot-blink-1 h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="dot-blink-2 h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
            <span className="dot-blink-3 h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
          </span>
        </div>
        {toolInfo && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 w-fit">
            <span className="text-[11px]">{toolInfo.icon}</span>
            <span className="text-[11px] text-slate-600 font-medium">{toolInfo.label}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// ERROR CARD
// ──────────────────────────────────────────────
function ErrorCard({ error }: { error: Error }) {
  const msg = error.message.toLowerCase()
  let userMsg = "Něco se pokazilo. Zkuste zadat dotaz znovu."
  if (msg.includes("credit") || msg.includes("balance") || msg.includes("quota")) {
    userMsg = "API kredity vyčerpány. Přidejte kredity na console.anthropic.com."
  } else if (msg.includes("rate") || msg.includes("429")) {
    userMsg = "Příliš mnoho požadavků. Počkejte chvíli a zkuste to znovu."
  } else if (msg.includes("timeout") || msg.includes("network")) {
    userMsg = "Problém se připojením. Zkontrolujte internet a zkuste znovu."
  }

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
      <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
      <div className="flex-1">
        <p className="text-[12px] text-red-700 font-medium">{userMsg}</p>
        <p className="text-[11px] text-red-400 mt-0.5">{error.message}</p>
      </div>
      <button
        onClick={() => window.location.reload()}
        className="flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-800 border border-red-200 rounded-md px-2 py-1 hover:bg-red-100 transition-colors shrink-0"
      >
        <RefreshCw className="h-3 w-3" />
        Obnovit
      </button>
    </div>
  )
}

// ──────────────────────────────────────────────
// CHAT PAGE
// ──────────────────────────────────────────────
export default function AgentPage() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFile, setUploadedFile] = useState<{ id: string; nazev: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [morningBrief, setMorningBrief] = useState<MorningBriefData | null>(null)
  const [briefDismissed, setBriefDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check if morning brief should be shown (only when no messages yet)
    if (isMorningBriefDue() && loadMessages().length === 0) {
      fetch("/api/morning-brief", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setMorningBrief(data as MorningBriefData)
            markMorningBriefShown()
          }
        })
        .catch(() => {/* ignore */})
    }
  }, [])

  const initialMessages = useMemo(() => loadMessages(), [])

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    messages: initialMessages,
  })

  // Persist to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    }
  }, [messages])

  const isLoading = status === "submitted" || status === "streaming"

  // Find the active tool name (for the thinking indicator chip)
  const activeToolName = useMemo(() => {
    if (!isLoading) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i]
      for (const part of msg.parts) {
        if (part.type.startsWith("tool-")) {
          const toolPart = part as {
            type: string
            state: string
          }
          if (
            toolPart.state === "input-streaming" ||
            toolPart.state === "input-available"
          ) {
            return part.type.slice(5)
          }
        }
      }
      if (msg.role === "user") break
    }
    return null
  }, [isLoading, messages])

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isLoading])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const value = textareaRef.current?.value.trim()
    if (!value || isLoading) return
    sendMessage({ text: value })
    if (textareaRef.current) textareaRef.current.value = ""
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as React.FormEvent)
    }
  }

  const handleQuickAction = useCallback((prompt: string) => {
    if (isLoading) return
    setBriefDismissed(true)
    sendMessage({ text: prompt })
  }, [isLoading, sendMessage])

  const handleClearChat = () => {
    localStorage.removeItem(STORAGE_KEY)
    window.location.reload()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: form })
      const data = await res.json()
      if (data.id) {
        setUploadedFile({ id: data.id, nazev: data.nazev })
        if (textareaRef.current) {
          const hint = `[Soubor: ${data.nazev}] Analyzuj tento soubor a řekni mi, co v něm je.`
          textareaRef.current.value = hint
        }
      }
    } catch { /* ignore */ } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSubmitWithFile = (e: React.FormEvent) => {
    e.preventDefault()
    const value = textareaRef.current?.value.trim()
    if (!value || isLoading) return
    let text = value
    if (uploadedFile) {
      text = `${value}\n\n[fileId: ${uploadedFile.id}]`
      setUploadedFile(null)
    }
    sendMessage({ text })
    if (textareaRef.current) textareaRef.current.value = ""
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-6rem)] md:h-[calc(100vh-6rem)]">
      {/* ── Sidebar: Quick Actions (desktop only) ── */}
      <div className="hidden lg:flex w-72 shrink-0 flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 mb-0.5">Rychlé akce</h2>
          <p className="text-[11px] text-slate-400">Klikni pro předvyplnění dotazu</p>
        </div>
        <div className="space-y-2 flex-1 overflow-y-auto">
          {QUICK_ACTIONS.map((action) => (
            <div
              key={action.title}
              className="cursor-pointer border border-slate-200 shadow-none bg-white hover:border-emerald-300 hover:shadow-sm hover:bg-emerald-50/30 active:scale-[0.99] transition-all duration-150 rounded-xl ring-0 px-3 py-2.5 flex items-start gap-2.5"
              onClick={() => handleQuickAction(action.prompt)}
            >
              <span className="text-lg leading-none mt-0.5">{action.icon}</span>
              <div>
                <div className="text-[12px] font-semibold text-slate-800">{action.title}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{action.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex flex-1 flex-col gap-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 ring-1 ring-emerald-500/30">
            <Bot className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-slate-900 leading-tight">Pepa 2.0</h1>
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  isLoading ? "bg-amber-400 animate-pulse" : "bg-emerald-400"
                )}
              />
              <span className="text-[11px] text-slate-400">
                {isLoading ? "Pepa přemýšlí…" : "Připraven"}
              </span>
            </div>
          </div>
          {mounted && messages.length > 0 && (
            <button
              onClick={handleClearChat}
              title="Smazat konverzaci"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Morning brief card */}
          {mounted && morningBrief && !briefDismissed && messages.length === 0 && (
            <div className="pb-4">
              <MorningBriefCard
                data={morningBrief}
                onAction={handleQuickAction}
                onDismiss={() => setBriefDismissed(true)}
              />
            </div>
          )}

          {/* Welcome screen or messages */}
          {!mounted || messages.length === 0 ? (
            <WelcomeScreen onAction={handleQuickAction} />
          ) : (
            messages.map((message) => {
              const isUser = message.role === "user"
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start gap-3",
                    isUser ? "flex-row-reverse msg-in-right" : "msg-in-left"
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                      isUser
                        ? "bg-slate-200 text-slate-600"
                        : "bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-500/30"
                    )}
                  >
                    {isUser ? <User className="h-3.5 w-3.5" /> : "P"}
                  </div>

                  {/* Message bubble + tool results */}
                  <div
                    className={cn(
                      "flex max-w-[80%] flex-col gap-2",
                      isUser && "items-end"
                    )}
                  >
                    {message.parts.map((part, idx) => {
                      if (part.type === "text") {
                        if (!part.text.trim()) return null
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "rounded-xl px-4 py-2.5 text-[13px] leading-relaxed",
                              isUser
                                ? "bg-slate-900 text-white rounded-tr-sm"
                                : "bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-sm"
                            )}
                          >
                            {isUser ? (
                              <p>{part.text}</p>
                            ) : (
                              <RenderText text={part.text} />
                            )}
                          </div>
                        )
                      }

                      if (part.type.startsWith("tool-")) {
                        const toolName = part.type.slice(5)
                        const toolPart = part as {
                          type: string
                          toolCallId: string
                          state:
                            | "input-streaming"
                            | "input-available"
                            | "output-available"
                            | "output-error"
                          input?: unknown
                          output?: unknown
                          errorText?: string
                        }
                        return (
                          <div key={idx} className="w-full max-w-2xl tool-reveal">
                            <ToolResultRenderer
                              toolName={toolName}
                              state={toolPart.state}
                              input={toolPart.input}
                              output={toolPart.output}
                              errorText={toolPart.errorText}
                            />
                          </div>
                        )
                      }

                      return null
                    })}
                  </div>
                </div>
              )
            })
          )}

          {/* Thinking indicator */}
          {isLoading && (
            messages.length === 0 ||
            messages[messages.length - 1]?.role === "user" ||
            activeToolName !== null
          ) && (
            <ThinkingIndicator activeToolName={activeToolName} />
          )}

          {/* Error */}
          {error && <ErrorCard error={error} />}
        </div>

        {/* Input */}
        <div className="border-t border-slate-100 px-4 py-3">
          {uploadedFile && (
            <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <FileText className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              <span className="text-[12px] text-emerald-700 font-medium truncate flex-1">{uploadedFile.nazev}</span>
              <button onClick={() => setUploadedFile(null)} className="text-emerald-400 hover:text-emerald-700">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmitWithFile} className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.json,.txt,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || uploading}
              title="Nahrát soubor (CSV, XLSX, JSON, TXT, PDF)"
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-150",
                "text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              )}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            </button>
            <Textarea
              ref={textareaRef}
              placeholder="Zeptejte se Pepy… (Enter = odeslat, Shift+Enter = nový řádek)"
              className="min-h-[44px] max-h-[140px] resize-none text-sm border-slate-200 bg-slate-50 focus:border-emerald-400 focus:ring-0 focus-visible:ring-0 rounded-xl placeholder:text-slate-400"
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              rows={1}
            />
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-150 active:scale-95",
                isLoading
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm hover:shadow-md"
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
          <p className="text-center text-[10px] text-slate-300 mt-2">
            Data jsou z demo prostředí. Pepa 2.0 • claude-sonnet-4-6
          </p>
        </div>
      </div>
    </div>
  )
}
