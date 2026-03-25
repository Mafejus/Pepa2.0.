import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { SessionProviderWrapper } from "@/components/layout/session-provider"
import { AppShell } from "@/components/layout/app-shell"

export const metadata: Metadata = {
  title: "Pepa 2.0 | AI Back Office Agent",
  description: "AI asistent pro back-office operace realitní firmy",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%2310b981'/><text y='.9em' font-size='75' x='12'>🤖</text></svg>",
        type: "image/svg+xml",
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="cs" className="h-full antialiased">
      <body className="h-full bg-slate-50">
        <SessionProviderWrapper>
          <AppShell>
            {children}
          </AppShell>
          <Toaster />
        </SessionProviderWrapper>
      </body>
    </html>
  )
}
