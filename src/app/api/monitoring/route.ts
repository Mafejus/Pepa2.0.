import { NextRequest, NextResponse } from "next/server"
import { monitoringResults } from "@/lib/data/monitoring"

export function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  let result = [...monitoringResults]

  const dnes = searchParams.get("dnes")
  if (dnes === "true") {
    result = result.filter((m) => m.novinka === true)
  }

  const lokalita = searchParams.get("lokalita")
  if (lokalita) {
    result = result.filter((m) =>
      m.lokalita.toLowerCase().includes(lokalita.toLowerCase())
    )
  }

  return NextResponse.json(result)
}
