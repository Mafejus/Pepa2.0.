import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig } from "prisma/config"

// Load .env.local for Prisma CLI (Next.js convention)
try {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8")
  for (const line of raw.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (key && !(key in process.env)) process.env[key] = val
  }
} catch {
  // .env.local not found — rely on process.env or .env
}

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) throw new Error("DATABASE_URL is not set. Check .env.local")

export default defineConfig({
  migrations: {
    seed: "tsx ./prisma/seed.ts",
  },
  datasource: {
    url: dbUrl,
  },
})
