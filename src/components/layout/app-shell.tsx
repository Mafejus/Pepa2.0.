"use client"

import { usePathname } from "next/navigation"
import { Sidebar } from "@/components/layout/sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLogin = pathname === "/login"

  if (isLogin) return <>{children}</>

  return (
    <>
      <Sidebar />
      <main className="pl-0 md:pl-64 min-h-screen">
        <div className="h-14 md:h-0" />
        <div className="mx-auto max-w-screen-xl px-4 md:px-6 py-4 md:py-6 page-fade-in">
          {children}
        </div>
      </main>
    </>
  )
}
