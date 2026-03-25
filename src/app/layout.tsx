import type { Metadata } from "next"
import "./globals.css"
import { Sidebar } from "@/components/layout/sidebar"
import { Toaster } from "@/components/ui/toaster"

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
        <Sidebar />
        {/* Desktop: pl-64 offset for sidebar; mobile: pt-14 for top bar */}
        <main className="pl-0 md:pl-64 min-h-screen">
          <div className="h-14 md:h-0" />
          <div className="mx-auto max-w-screen-xl px-4 md:px-6 py-4 md:py-6 page-fade-in">
            {children}
          </div>
        </main>
        <Toaster />
      </body>
    </html>
  )
}
