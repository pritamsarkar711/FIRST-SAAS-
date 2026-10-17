"use client";

/**
 * Compatibility shim replacing next-auth/react's useSession for the
 * Laravel + Inertia port. The Inertia HandleInertiaRequests middleware
 * shares `auth.user` on every request, so every component can read the
 * session exactly like before.
 */
import { usePage } from "@inertiajs/react";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string;
  status: string;
  credits: number;
  referralCode?: string;
  twoFactorEnabled?: boolean;
}

type Session = {
  data: { user: SessionUser | null } | null;
  status: "authenticated" | "unauthenticated";
};

export function useSession(): Session {
  const { props } = usePage() as unknown as { props: { auth?: { user?: SessionUser | null } } };
  const user = props?.auth?.user ?? null;
  return {
    data: user ? { user } : null,
    status: user ? "authenticated" : "unauthenticated",
  };
}

export function useAuthUser(): SessionUser | null {
  return useSession().data?.user ?? null;
}
