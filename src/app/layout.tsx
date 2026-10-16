import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/shared/theme";
import { existsSync } from "fs";
import path from "path";

const openSans = Open_Sans({
  variable: "--font-app",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: {
    default: "AdAudit — Know your AdSense approval odds before you apply",
    template: "%s | AdAudit",
  },
  description:
    "AdAudit audits your blog against Google AdSense and premium ad network policies, shows a clear approval probability with green, orange and red findings, and gives you a fix-first roadmap and PDF report.",
  keywords: ["adsense approval checker", "adsense eligibility", "ad network audit", "low value content fix", "ezoic", "mediavine", "raptive"],
  authors: [{ name: "AdAudit" }],
  openGraph: {
    title: "AdAudit — AdSense approval readiness, decoded",
    description: "Run a full policy, content and trust audit of your site before you apply to AdSense or premium ad networks.",
    type: "website",
    siteName: "AdAudit",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d6b4d",
};

// If the production Telenor font files are dropped into /public/fonts they are
// used automatically; otherwise Open Sans (visually closest humanist face) ships.
const telenorWoff2 = path.join(process.cwd(), "public", "fonts", "Telenor-Regular.woff2");
const hasTelenor = existsSync(telenorWoff2);

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {hasTelenor ? (
          <style
            dangerouslySetInnerHTML={{
              __html: `@font-face{font-family:'Telenor';src:url('/fonts/Telenor-Regular.woff2') format('woff2');font-weight:400;font-style:normal;font-display:swap;}@font-face{font-family:'Telenor';src:url('/fonts/Telenor-Bold.woff2') format('woff2');font-weight:600 800;font-style:normal;font-display:swap;}`,
            }}
          />
        ) : null}
      </head>
      <body className={`${openSans.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}>
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
