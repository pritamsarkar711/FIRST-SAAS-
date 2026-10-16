import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { getSetting, GOOGLE_DEFAULTS } from "@/lib/settings";
import { ensureSeeded } from "@/lib/seed";
import { totpVerify } from "@/lib/totp";
import { logActivity } from "@/lib/activity";

function reqIp(req: unknown): string | null {
  try {
    const h = (req as { headers?: Record<string, string | string[] | undefined> }).headers;
    if (!h) return null;
    const fwd = h["x-forwarded-for"];
    const ip = (Array.isArray(fwd) ? fwd[0] : fwd) || h["x-real-ip"];
    return typeof ip === "string" ? ip.split(",")[0].trim() : null;
  } catch {
    return null;
  }
}

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
        async authorize(credentials, req) {
          const ip = reqIp(req);
          const email = (credentials?.email || "").trim().toLowerCase();
          const password = credentials?.password || "";
          if (!email || !password) return null;
          const user = await db.user.findUnique({ where: { email } });
          if (!user || !user.passwordHash) {
            logActivity({ action: "AUTH_LOGIN_FAILED", actorEmail: email || "unknown", detail: "No matching account", ip });
            return null;
          }
          if (!verifyPassword(password, user.passwordHash)) {
            logActivity({ action: "AUTH_LOGIN_FAILED", actorEmail: email, userId: user.id, detail: "Wrong password", ip });
            return null;
          }
          if (user.status === "SUSPENDED") {
            logActivity({ action: "AUTH_LOGIN_FAILED", actorEmail: email, userId: user.id, detail: "Account suspended", ip });
            throw new Error("ACCOUNT_SUSPENDED");
          }
          if (user.twoFactorEnabled && user.twoFactorSecret) {
            const code = (credentials?.code || "").trim();
            if (!code) {
              logActivity({ action: "AUTH_2FA_CHALLENGE", actorEmail: email, userId: user.id, ip });
              throw new Error("2FA_REQUIRED");
            }
            const ok = totpVerify(code, user.twoFactorSecret);
            if (!ok) {
              logActivity({ action: "AUTH_LOGIN_FAILED", actorEmail: email, userId: user.id, detail: "Invalid 2FA code", ip });
              throw new Error("INVALID_2FA");
            }
          }
          logActivity({
            action: user.role === "ADMIN" ? "ADMIN_LOGIN" : "AUTH_LOGIN",
            actorEmail: email,
            userId: user.id,
            ip,
          });
          return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status };
        },
      }),
      ...(google ? [google] : []),
    ],
    events: {
      async signOut(message) {
        const token = (message as { token?: { email?: string; uid?: string } }).token;
        if (token?.email) {
          logActivity({ action: "AUTH_LOGOUT", actorEmail: token.email, userId: (token.uid as string) || null });
        }
      },
    },
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
            logActivity({
              action: "AUTH_REGISTER",
              actorEmail: dbUser.email,
              userId: dbUser.id,
              detail: "Google sign-up",
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
