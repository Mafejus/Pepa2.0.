import { google } from "googleapis"
import { prisma } from "@/lib/db"
import { getOAuthClient } from "@/lib/google-calendar"

async function getGmailClient() {
  const token = await prisma.googleToken.findUnique({ where: { id: "default" } })
  if (!token) throw new Error("Google not connected")

  const oauth2Client = getOAuthClient()
  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken ?? undefined,
    expiry_date: token.expiresAt.getTime(),
  })

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

  return google.gmail({ version: "v1", auth: oauth2Client })
}

function decodeBase64(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8")
}

function getHeader(headers: { name?: string | null; value?: string | null }[], name: string): string {
  return headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ""
}

function extractTextFromParts(parts: {
  mimeType?: string | null
  body?: { data?: string | null } | null
  parts?: unknown[] | null
}[] | null | undefined): string {
  if (!parts) return ""
  for (const part of parts) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      return decodeBase64(part.body.data)
    }
    if (part.mimeType === "text/html" && part.body?.data) {
      const html = decodeBase64(part.body.data)
      return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    }
    if (part.parts) {
      const nested = extractTextFromParts(part.parts as typeof parts)
      if (nested) return nested
    }
  }
  return ""
}

export interface GmailMessage {
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

export async function getEmails(
  maxResults = 20,
  query = "in:inbox",
): Promise<GmailMessage[]> {
  const gmail = await getGmailClient()

  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  })

  const messageIds = listRes.data.messages ?? []
  if (messageIds.length === 0) return []

  const messages = await Promise.all(
    messageIds.map(async (m) => {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "full",
      })
      const headers = msg.data.payload?.headers ?? []
      const labels = msg.data.labelIds ?? []

      let telo = ""
      const payload = msg.data.payload
      if (payload?.body?.data) {
        telo = decodeBase64(payload.body.data)
      } else if (payload?.parts) {
        telo = extractTextFromParts(payload.parts)
      }

      return {
        id: m.id!,
        threadId: msg.data.threadId ?? "",
        od: getHeader(headers, "from"),
        komu: getHeader(headers, "to"),
        predmet: getHeader(headers, "subject"),
        datum: getHeader(headers, "date"),
        snippet: msg.data.snippet ?? "",
        telo: telo.slice(0, 2000),
        precteno: !labels.includes("UNREAD"),
        labels,
      } satisfies GmailMessage
    }),
  )

  return messages
}

export async function getEmailById(id: string): Promise<GmailMessage | null> {
  const gmail = await getGmailClient()
  const msg = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  })
  const headers = msg.data.payload?.headers ?? []
  const labels = msg.data.labelIds ?? []

  let telo = ""
  const payload = msg.data.payload
  if (payload?.body?.data) {
    telo = decodeBase64(payload.body.data)
  } else if (payload?.parts) {
    telo = extractTextFromParts(payload.parts)
  }

  return {
    id,
    threadId: msg.data.threadId ?? "",
    od: getHeader(headers, "from"),
    komu: getHeader(headers, "to"),
    predmet: getHeader(headers, "subject"),
    datum: getHeader(headers, "date"),
    snippet: msg.data.snippet ?? "",
    telo,
    precteno: !labels.includes("UNREAD"),
    labels,
  }
}

export async function sendEmail(to: string, subject: string, body: string): Promise<string> {
  const gmail = await getGmailClient()

  const profile = await gmail.users.getProfile({ userId: "me" })
  const from = profile.data.emailAddress ?? "me"

  const messageParts = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ]
  const raw = Buffer.from(messageParts.join("\n")).toString("base64url")

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  })

  return res.data.id ?? ""
}

export async function markAsRead(id: string): Promise<void> {
  const gmail = await getGmailClient()
  await gmail.users.messages.modify({
    userId: "me",
    id,
    requestBody: { removeLabelIds: ["UNREAD"] },
  })
}

export async function getUnreadCount(): Promise<number> {
  const gmail = await getGmailClient()
  const res = await gmail.users.messages.list({
    userId: "me",
    q: "in:inbox is:unread",
    maxResults: 1,
  })
  return res.data.resultSizeEstimate ?? 0
}
