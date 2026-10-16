import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { siteSettings, SITE_DEFAULTS } from "@/lib/settings";
import { ensureSeeded } from "@/lib/seed";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  await ensureSeeded().catch(() => {});
  const site = await siteSettings().catch(() => SITE_DEFAULTS);
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader siteName={site.name} />
      <main className="flex-1">{children}</main>
      <SiteFooter siteName={site.name} tagline={site.tagline} />
    </div>
  );
}
