import { google } from "googleapis"
import { prisma } from "@/lib/db"

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  )
}

async function getAuthenticatedClient() {
  const token = await prisma.googleToken.findUnique({ where: { id: "default" } })
  if (!token) throw new Error("Google Calendar not connected")

  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken ?? undefined,
    expiry_date: token.expiresAt.getTime(),
  })

  // Auto-refresh if expired or expiring soon (within 60s)
  if (token.expiresAt.getTime() < Date.now() + 60_000) {
    const { credentials } = await oauth2Client.refreshAccessToken()
    await prisma.googleToken.update({
      where: { id: "default" },
      data: {
        accessToken: credentials.access_token!,
        expiresAt: new Date(credentials.expiry_date!),
      },
    })
    oauth2Client.setCredentials(credentials)
  }

  return google.calendar({ version: "v3", auth: oauth2Client })
}

export async function getGoogleEvents(timeMin: string, timeMax: string) {
  const calendar = await getAuthenticatedClient()
  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 100,
  })

  const events = res.data.items ?? []
  return events.map((e) => ({
    id: e.id ?? crypto.randomUUID(),
    nazev: e.summary ?? "(bez názvu)",
    typ: "jine" as const,
    zacatek: e.start?.dateTime ?? e.start?.date ?? new Date().toISOString(),
    konec: e.end?.dateTime ?? e.end?.date ?? new Date().toISOString(),
    lokace: e.location ?? null,
    ucastnici: (e.attendees ?? []).map((a) => a.email ?? "").filter(Boolean),
    poznamka: e.description ?? null,
    propertyId: null,
    googleEventId: e.id ?? null,
    source: "google" as const,
  }))
}

export async function createGoogleEvent(event: {
  summary: string
  start: string
  end: string
  location?: string
  description?: string
  attendees?: { email: string }[]
}) {
  const calendar = await getAuthenticatedClient()
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: event.summary,
      start: { dateTime: event.start },
      end: { dateTime: event.end },
      location: event.location,
      description: event.description,
      attendees: event.attendees,
    },
  })
  return res.data
}

export async function updateGoogleEvent(
  googleEventId: string,
  event: {
    summary: string
    start: string
    end: string
    location?: string | null
    description?: string | null
    attendees?: { email: string }[]
  }
) {
  const calendar = await getAuthenticatedClient()
  const res = await calendar.events.update({
    calendarId: "primary",
    eventId: googleEventId,
    requestBody: {
      summary: event.summary,
      start: { dateTime: event.start },
      end: { dateTime: event.end },
      location: event.location ?? undefined,
      description: event.description ?? undefined,
      attendees: event.attendees,
    },
  })
  return res.data
}

export async function deleteGoogleEvent(googleEventId: string) {
  const calendar = await getAuthenticatedClient()
  await calendar.events.delete({
    calendarId: "primary",
    eventId: googleEventId,
  })
}

export async function isGoogleConnected(): Promise<boolean> {
  try {
    const token = await prisma.googleToken.findUnique({ where: { id: "default" } })
    return !!token
  } catch {
    return false
  }
}

export { getOAuthClient }
