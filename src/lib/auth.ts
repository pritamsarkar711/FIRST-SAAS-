import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getSetting, GOOGLE_DEFAULTS } from "@/lib/settings";
import { ensureSeeded } from "@/lib/seed";
import { totpVerify } from "@/lib/totp";

async function googleProvider() {
  const g = await getSetting("google", GOOGLE_DEFAULTS);
  const clientId = process.env.GOOGLE_CLIENT_ID || g.clientId;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || g.clientSecret;
  if (!clientId || !clientSecret) return null;
  return GoogleProvider({ clientId, clientSecret, allowDangerousEmailAccountLinking: true });
}

export async function buildAuthOptions(): Promise<NextAuthOptions> {
  await ensureSeeded();
  const google = await googleProvider();
  return {
    secret: process.env.NEXTAUTH_SECRET || "adaudit-dev-secret-change-in-production",
    session: { strategy: "jwt", maxAge: 30 * 24 * 3600 },
    pages: { signIn: "/login", error: "/login" },
    providers: [
      CredentialsProvider({
        name: "Email and password",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
          code: { label: "2FA code", type: "text" },
        },
        async authorize(credentials) {
          const email = (credentials?.email || "").trim().toLowerCase();
          const password = credentials?.password || "";
          if (!email || !password) return null;
          const user = await db.user.findUnique({ where: { email } });
          if (!user || !user.passwordHash) return null;
          if (!verifyPassword(password, user.passwordHash)) return null;
          if (user.status === "SUSPENDED") throw new Error("ACCOUNT_SUSPENDED");
          if (user.twoFactorEnabled && user.twoFactorSecret) {
            const code = (credentials?.code || "").trim();
            if (!code) throw new Error("2FA_REQUIRED");
            const ok = totpVerify(code, user.twoFactorSecret);
            if (!ok) throw new Error("INVALID_2FA");
          }
          return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status };
        },
      }),
      ...(google ? [google] : []),
    ],
    callbacks: {
      async jwt({ token, user, account, profile }) {
        if (user) {
          let dbUser = await db.user.findUnique({ where: { email: (user.email || "").toLowerCase() } });
          if (!dbUser && account?.provider === "google") {
            const referralCookie = undefined; // handled at callback route
            dbUser = await db.user.create({
              data: {
                email: (user.email || "").toLowerCase(),
                name: user.name || (profile?.name as string) || "",
                image: (user as { image?: string }).image || null,
                referralCode: `AD${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
              },
            });
          }
          if (dbUser) {
            if (dbUser.status === "SUSPENDED") throw new Error("ACCOUNT_SUSPENDED");
            token.uid = dbUser.id;
            token.role = dbUser.role;
            token.status = dbUser.status;
          }
        }
        return token;
      },
      async session({ session, token }) {
        if (session.user) {
          (session.user as { id?: string }).id = token.uid as string;
          (session.user as { role?: string }).role = token.role as string;
          (session.user as { status?: string }).status = token.status as string;
        }
        return session;
      },
    },
  };
}

// Augmentation helper
export interface SessionUser {
  id: string;
  role: string;
  status?: string;
}

declare module "next-auth" {
  interface Session {
    user: { name?: string | null; email?: string | null; image?: string | null; id?: string; role?: string; status?: string };
  }
}

/** Session reader that always carries the correct options. */
export async function auth() {
  return getServerSession(await buildAuthOptions());
}
