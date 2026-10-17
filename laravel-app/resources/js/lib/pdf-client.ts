import { createElement } from "react";
import { pdf } from "@react-pdf/renderer";
import { AuditPDF } from "@/lib/audit-pdf";

/**
 * Browser PDF download for audit reports. The original app rendered the PDF
 * on the server (`renderToBuffer` behind /api/audit/{id}/pdf); in the Laravel
 * port the same <AuditPDF> document is generated client-side with
 * @react-pdf/renderer and saved as a blob.
 */
export async function downloadAuditPdf(
  report: any,
  meta: { domain: string; mode: string; target: string; createdAt?: string; siteName?: string; signals?: unknown },
): Promise<void> {
  interface DeepSig {
    estimatedPages?: number;
    articles?: { length: number }[];
    homepage?: { platform?: string };
    deepScan?: boolean;
    navPageChecks?: { path: string; url: string; statusCode: number; wordCount: number; hasContent: boolean }[];
    categoryCheck?: { url: string; statusCode: number; wordCount: number; articleLinks: number } | null;
    contentFreshness?: { newest: string | null; oldest: string | null; datedArticles: number; within365d: number; within90d: number } | null;
    thinArticleRatio?: number | null;
  }
  const sig = (meta.signals && typeof meta.signals === "object" ? meta.signals : null) as DeepSig | null;
  const summaryData = sig
    ? {
        pages: Number(sig.estimatedPages || 0),
        articles: Array.isArray(sig.articles) ? sig.articles.length : 0,
        platform: sig.homepage?.platform || "Unknown",
      }
    : null;
  const deep = sig?.deepScan === true;
  const deepData = deep && sig ? {
    nav: (sig.navPageChecks || []).slice(0, 4).map((p) => ({ path: p.path, status: p.statusCode, words: p.wordCount, hasContent: p.hasContent })),
    newest: sig.contentFreshness?.newest || null,
    oldest: sig.contentFreshness?.oldest || null,
    dated: sig.contentFreshness?.datedArticles || 0,
    recent90: sig.contentFreshness?.within90d || 0,
    thin: typeof sig.thinArticleRatio === "number" ? sig.thinArticleRatio : null,
    category: sig.categoryCheck ? { url: sig.categoryCheck.url, status: sig.categoryCheck.statusCode, words: sig.categoryCheck.wordCount, links: sig.categoryCheck.articleLinks } : null,
  } : null;

  const dateLabel = new Date(meta.createdAt || Date.now()).toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric",
  });

  const blob = await pdf(
    createElement(AuditPDF, {
      domain: meta.domain,
      target: meta.target,
      mode: meta.mode,
      date: dateLabel,
      report,
      siteName: meta.siteName || "Audit Form",
      summaryData,
      deep,
      deepData,
    }),
  ).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-report-${meta.domain.replace(/[^a-z0-9.-]+/gi, "-")}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
