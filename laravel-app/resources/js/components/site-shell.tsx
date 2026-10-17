import { usePage } from "@inertiajs/react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/**
 * Port of the Next.js `src/app/(site)/layout.tsx` (server layout).
 * Site settings (name/tagline) arrive as shared Inertia props from
 * HandleInertiaRequests (`site.name`, `site.tagline`) instead of the
 * server-side siteSettings() call.
 */
export default function SiteShell({ children }: { children: React.ReactNode }) {
  const { props } = usePage() as unknown as { props: { site?: { name?: string; tagline?: string } } };
  const site = props?.site ?? { name: "Audit Form", tagline: "" };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader siteName={site.name ?? "Audit Form"} />
      <main className="flex-1">{children}</main>
      <SiteFooter siteName={site.name ?? "Audit Form"} tagline={site.tagline ?? ""} />
    </div>
  );
}
