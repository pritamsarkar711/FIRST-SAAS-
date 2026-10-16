import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/shared/theme";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXTAUTH_URL ||
    "http://localhost:3000"
  ),
  title: {
    default: "Audit Form — Know your AdSense approval odds before you apply",
    template: "%s | Audit Form",
  },
  description:
    "Audit Form audits your blog against Google AdSense and premium ad network policies, shows a clear approval probability with green, orange and red findings, and gives you a fix-first roadmap and PDF report.",
  keywords: ["adsense approval checker", "adsense eligibility", "ad network audit", "low value content fix", "ezoic", "mediavine", "raptive"],
  authors: [{ name: "Audit Form" }],
  openGraph: {
    title: "Audit Form — AdSense approval readiness, decoded",
    description: "Run a full policy, content and trust audit of your site before you apply to AdSense or premium ad networks.",
    type: "website",
    siteName: "Audit Form",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f86642",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/Telenor-Regular.woff" as="font" type="font/woff" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Telenor-Bold.woff" as="font" type="font/woff" crossOrigin="anonymous" />
      </head>
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
