import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const secret = process.env.NEXTAUTH_SECRET || "adaudit-dev-secret-change-in-production";

export async function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  // Referral capture: store code in a 30 day cookie, then strip the param
  const ref = searchParams.get("ref");
  if (ref && /^[A-Za-z0-9]{3,12}$/.test(ref)) {
    const url = new URL(req.url);
    url.searchParams.delete("ref");
    const res = NextResponse.redirect(url);
    res.cookies.set("ref", ref.toUpperCase(), { maxAge: 30 * 24 * 3600, path: "/", sameSite: "lax" });
    return res;
  }

  if (pathname.startsWith("/dashboard")) {
    const token = await getToken({ req, secret });
    if (!token) {
      const url = new URL("/login", req.url);
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith("/manage") && pathname !== "/manage/login") {
    const token = await getToken({ req, secret });
    if (!token) {
      return NextResponse.redirect(new URL("/manage/login", req.url));
    }
    if (token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/", "/features/:path*", "/how-it-works/:path*", "/tools/:path*", "/pricing/:path*",
    "/blog/:path*", "/about/:path*", "/contact/:path*", "/login", "/register",
    "/dashboard/:path*", "/manage/:path*",
  ],
};
