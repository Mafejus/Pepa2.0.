"use client"

import { useState, useEffect, useCallback } from "react"
import { Mail, Send, RefreshCw, Inbox, Search, X, Loader2, ExternalLink, AlertTriangle, CheckCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Email {
  id: string
  threadId: string
  od: string
  komu: string
  predmet: string
  datum: string
  snippet: string
  telo: string
  precteno: boolean
  labels: string[]
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("cs-CZ", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return dateStr
  }
}

function parseSender(from: string) {
  const match = from.match(/^(.+?)\s*<(.+?)>$/)
  if (match) return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2] }
  return { name: from, email: from }
}

function EmailRow({ email, selected, onClick }: {
  email: Email
  selected: boolean
  onClick: () => void
}) {
  const sender = parseSender(email.od)
  return (
    <div
      onClick={onClick}
      className={cn(
        "px-4 py-3 border-b border-slate-100 cursor-pointer transition-colors",
        selected ? "bg-emerald-50 border-l-2 border-l-emerald-400" : "hover:bg-slate-50",
        !email.precteno && "bg-blue-50/40",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">
          {sender.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("text-[13px] truncate", !email.precteno ? "font-semibold text-slate-900" : "text-slate-700")}>
              {sender.name}
            </span>
            <span className="text-[11px] text-slate-400 shrink-0">{formatDate(email.datum)}</span>
          </div>
          <div className={cn("text-[12px] truncate", !email.precteno ? "font-medium text-slate-800" : "text-slate-600")}>
            {email.predmet || "(bez předmětu)"}
          </div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">{email.snippet}</div>
        </div>
        {!email.precteno && (
          <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />
        )}
      </div>
    </div>
  )
}

function ComposeDialog({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const [to, setTo] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSend = async () => {
    if (!to || !subject || !body) { setError("Vyplňte všechna pole"); return }
    setSending(true)
    setError(null)
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || "Chyba při odesílání")
      }
      onSent()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chyba")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
      <div className="w-full max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Send className="h-4 w-4 text-emerald-500" />
            Nový email
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Komu</label>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@example.com"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Předmět</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Předmět emailu"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">Zpráva</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Napište zprávu…"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none resize-none"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-[12px] text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">
              Zrušit
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Odeslat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EmailyPage() {
  const [emails, setEmails] = useState<Email[]>([])
  const [selected, setSelected] = useState<Email | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [composeOpen, setComposeOpen] = useState(false)
  const [sentMsg, setSentMsg] = useState(false)
  const [tab, setTab] = useState<"inbox" | "sent" | "unread">("inbox")

  const fetchEmails = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const queryMap = {
        inbox: "in:inbox",
        sent: "in:sent",
        unread: "in:inbox is:unread",
      }
      const res = await fetch(`/api/gmail?q=${encodeURIComponent(queryMap[tab])}&limit=30`)
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setEmails(data.emails ?? [])
      }
    } catch {
      setError("Nepodařilo se načíst emaily")
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    fetchEmails()
  }, [fetchEmails])

  const openEmail = async (email: Email) => {
    setSelected(email)
    if (!email.precteno) {
      // Fetch full email and mark as read
      try {
        const res = await fetch(`/api/gmail/${email.id}`)
        const full = await res.json()
        setSelected(full)
        setEmails((prev) => prev.map((e) => e.id === email.id ? { ...e, precteno: true } : e))
      } catch { /* keep snippet */ }
    }
  }

  const filteredEmails = emails.filter((e) =>
    !search ||
    e.predmet.toLowerCase().includes(search.toLowerCase()) ||
    e.od.toLowerCase().includes(search.toLowerCase()) ||
    e.snippet.toLowerCase().includes(search.toLowerCase())
  )

  const unreadCount = emails.filter((e) => !e.precteno).length

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] gap-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Mail className="h-5 w-5 text-emerald-500" />
            Emaily
            {unreadCount > 0 && (
              <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">{unreadCount}</Badge>
            )}
          </h1>
          <p className="text-[12px] text-slate-400 mt-0.5">Gmail integrací s automatickým čtením</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchEmails}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Obnovit
          </button>
          <button
            onClick={() => setComposeOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
          >
            <Send className="h-3.5 w-3.5" />
            Napsat
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Email list */}
        <div className="flex flex-col w-80 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-100">
            {(["inbox", "unread", "sent"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 py-2.5 text-[11px] font-medium transition-colors",
                  tab === t ? "text-emerald-600 border-b-2 border-emerald-400" : "text-slate-400 hover:text-slate-700"
                )}
              >
                {t === "inbox" ? "Doručené" : t === "unread" ? "Nepřečtené" : "Odeslané"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-slate-100">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5">
              <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Hledat…"
                className="flex-1 bg-transparent text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              {search && (
                <button onClick={() => setSearch("")}>
                  <X className="h-3 w-3 text-slate-400" />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32 gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-[12px]">Načítám emaily…</span>
              </div>
            ) : error ? (
              <div className="p-4 text-center">
                <AlertTriangle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                <p className="text-[12px] text-slate-600 font-medium">{error}</p>
                {error.includes("not connected") && (
                  <a href="/api/auth/google" className="mt-2 inline-block text-[11px] text-emerald-600 underline">
                    Připojit Google
                  </a>
                )}
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <Inbox className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-[12px] text-slate-400">Žádné emaily</p>
                </div>
              </div>
            ) : (
              filteredEmails.map((email) => (
                <EmailRow
                  key={email.id}
                  email={email}
                  selected={selected?.id === email.id}
                  onClick={() => openEmail(email)}
                />
              ))
            )}
          </div>
        </div>

        {/* Email detail */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {selected ? (
            <>
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-base font-semibold text-slate-900">{selected.predmet || "(bez předmětu)"}</h2>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-[12px] text-slate-500">Od: <span className="text-slate-700">{selected.od}</span></span>
                  <span className="text-[12px] text-slate-400">•</span>
                  <span className="text-[12px] text-slate-400">{formatDate(selected.datum)}</span>
                  {selected.labels.includes("UNREAD") ? (
                    <Badge className="bg-blue-100 text-blue-700 text-[10px]">Nepřečteno</Badge>
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setComposeOpen(true)}
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-emerald-600 border border-slate-200 rounded-md px-2 py-1 hover:border-emerald-300"
                  >
                    <Send className="h-3 w-3" />
                    Odpovědět
                  </button>
                  <a
                    href={`https://mail.google.com/mail/u/0/#inbox/${selected.threadId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 border border-slate-200 rounded-md px-2 py-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Gmail
                  </a>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-5">
                <pre className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap font-sans">
                  {selected.telo || selected.snippet}
                </pre>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Mail className="h-12 w-12 text-slate-200 mx-auto mb-3" />
                <p className="text-[13px] text-slate-400">Vyberte email pro zobrazení</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {sentMsg && (
        <div className="fixed bottom-6 right-6 bg-emerald-500 text-white text-[12px] font-medium px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          Email byl odeslán
        </div>
      )}

      {composeOpen && (
        <ComposeDialog
          onClose={() => setComposeOpen(false)}
          onSent={() => { setSentMsg(true); setTimeout(() => setSentMsg(false), 3000) }}
        />
      )}
    </div>
  )
}
