"use client"

import { useState, useEffect, useCallback } from "react"
import { subscribeToast } from "@/lib/toast"
import { CheckCircle2, XCircle, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface ToastItem {
  id: number
  message: string
  type: "success" | "error"
}

let nextId = 0

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    return subscribeToast((message, type) => {
      const id = nextId++
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => dismiss(id), 3500)
    })
  }, [dismiss])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "pointer-events-auto flex items-center gap-3 rounded-xl border bg-white shadow-lg px-4 py-3 min-w-[260px] max-w-sm",
            "animate-in slide-in-from-bottom-2 fade-in-0 duration-200",
            t.type === "error" ? "border-red-200" : "border-emerald-200"
          )}
        >
          {t.type === "error" ? (
            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
          )}
          <span className="text-[13px] font-medium text-slate-700 flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="text-slate-300 hover:text-slate-500 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
