import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/db"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email:    { label: "Email",  type: "email" },
        password: { label: "Heslo",  type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        })
        if (!user || !user.aktivni) return null
        const isValid = await compare(credentials.password as string, user.passwordHash)
        if (!isValid) return null
        return {
          id:       user.id,
          email:    user.email,
          name:     `${user.jmeno} ${user.prijmeni}`,
          role:     user.role,
          jmeno:    user.jmeno,
          prijmeni: user.prijmeni,
          pozice:   user.pozice ?? undefined,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as unknown as Record<string, unknown>
        token.id      = u.id as string
        token.role    = u.role as string
        token.jmeno   = u.jmeno as string
        token.prijmeni = u.prijmeni as string
        token.pozice  = u.pozice as string | undefined
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const su = session.user as unknown as Record<string, unknown>
        su.id       = token.id
        su.role     = token.role
        su.jmeno    = token.jmeno
        su.prijmeni = token.prijmeni
        su.pozice   = token.pozice
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET ?? "pepa2-super-secret-key-change-in-production",
})
