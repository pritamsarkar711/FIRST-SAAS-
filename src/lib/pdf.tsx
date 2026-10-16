import React from "react";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";
import type { AuditReport, AuditReportSection } from "@/lib/audit-runner";
import { networkName } from "@/lib/audit-runner";

const C = {
  primary: "#f86642",
  primarySoft: "#fdeae4",
  ink: "#1d1d1d",
  muted: "#5b6470",
  border: "#e3e7eb",
  ok: "#1f9d66",
  okSoft: "#e7f5ee",
  warn: "#c77700",
  warnSoft: "#fdf3e3",
  risk: "#d64545",
  riskSoft: "#fbeae8",
};

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 44, fontSize: 10, color: C.ink, fontFamily: "Helvetica" },
  brandBar: { backgroundColor: C.primary, color: "#ffffff", paddingHorizontal: 44, paddingTop: 14, paddingBottom: 16 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandName: { fontSize: 16, fontWeight: 700, color: "#ffffff" },
  brandTag: { fontSize: 9, color: "#ffe3d9" },
  h1: { fontSize: 22, fontWeight: 700, marginTop: 18 },
  sub: { fontSize: 10, color: C.muted, marginTop: 4 },
  metaRow: { flexDirection: "row", marginTop: 10 },
  metaBox: { borderWidth: 1, borderColor: C.border, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10, marginRight: 8, backgroundColor: "#fafbfc" },
  metaLabel: { fontSize: 7.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  metaValue: { fontSize: 10.5, fontWeight: 700, marginTop: 2 },
  scoreCard: { marginTop: 20, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 18, flexDirection: "row", alignItems: "center" },
  scoreNum: { fontSize: 46, fontWeight: 700 },
  scoreLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.8 },
  barBg: { height: 8, backgroundColor: "#eef0f2", borderRadius: 4, marginTop: 8, overflow: "hidden" },
  verdict: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, fontSize: 11, fontWeight: 700, textTransform: "uppercase", alignSelf: "flex-start" },
  summary: { marginTop: 16, fontSize: 11, lineHeight: 1.6, color: C.ink },
  h2: { fontSize: 15, fontWeight: 700, marginTop: 22, marginBottom: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border },
  h3: { fontSize: 11.5, fontWeight: 700, marginTop: 12, marginBottom: 6 },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 6 },
  item: { flexDirection: "row", marginBottom: 7 },
  dot: { width: 9, height: 9, borderRadius: 4.5, marginTop: 2.5, marginRight: 8 },
  itemLabel: { fontSize: 10, fontWeight: 700 },
  itemDetail: { fontSize: 9.5, color: C.muted, lineHeight: 1.5, marginTop: 1 },
  chip: { fontSize: 8, fontWeight: 700, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3 },
  li: { flexDirection: "row", marginBottom: 4 },
  liBullet: { width: 12, fontSize: 10, color: C.primary, fontWeight: 700 },
  liText: { flex: 1, fontSize: 9.5, lineHeight: 1.5, color: C.ink },
  roadmapStep: { flexDirection: "row", marginBottom: 8 },
  stepNum: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.primary, color: "#ffffff", fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: 20, marginRight: 10 },
  footer: { position: "absolute", bottom: 26, left: 44, right: 44, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, fontSize: 8, color: C.muted },
});

function statusColor(st: string): { main: string; soft: string } {
  if (st === "ok") return { main: C.ok, soft: C.okSoft };
  if (st === "risk") return { main: C.risk, soft: C.riskSoft };
  return { main: C.warn, soft: C.warnSoft };
}

function VerdictPill({ verdict }: { verdict: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    APPLY_NOW: { label: "Apply now", color: C.ok, bg: C.okSoft },
    WAIT_AND_IMPROVE: { label: "Wait and improve", color: C.warn, bg: C.warnSoft },
    HIGH_RISK_OF_REJECTION: { label: "High risk of rejection", color: C.risk, bg: C.riskSoft },
  };
  const v = map[verdict] || { label: verdict, color: C.muted, bg: "#f2f4f3" };
  return <Text style={[s.verdict, { color: v.color, backgroundColor: v.bg }]}>{v.label}</Text>;
}

function SectionBlock({ section }: { section: AuditReportSection }) {
  const col = statusColor(section.status);
  return (
    <View wrap={false}>
      <View style={s.sectionHead}>
        <Text style={s.h3}>{section.title}</Text>
        <Text style={[s.chip, { backgroundColor: col.soft, color: col.main }]}>{section.score}/100</Text>
      </View>
      <View style={[s.barBg, { marginBottom: 6 }]}>
        <View style={{ width: `${section.score}%`, height: 8, backgroundColor: col.main, borderRadius: 4 }} />
      </View>
      {section.items.map((it, i) => {
        const c = statusColor(it.status);
        return (
          <View key={i} style={s.item} wrap={false}>
            <View style={[s.dot, { backgroundColor: c.main }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.itemLabel}>{it.label}</Text>
              <Text style={s.itemDetail}>{it.detail}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function ListBlock({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items?.length) return null;
  return (
    <View wrap={false}>
      <Text style={[s.h3, { color }]}>{title}</Text>
      {items.map((it, i) => (
        <View key={i} style={s.li}>
          <Text style={s.liBullet}>{i + 1}.</Text>
          <Text style={s.liText}>{it}</Text>
        </View>
      ))}
    </View>
  );
}

function AuditPdfDoc({
  domain, target, mode, date, report, siteName, summaryData, deep, deepData,
}: {
  domain: string;
  target: string;
  mode: string;
  date: string;
  report: AuditReport;
  siteName: string;
  summaryData: { pages: number; articles: number; platform: string } | null;
  deep: boolean;
  deepData: {
    nav: { path: string; status: number; words: number; hasContent: boolean }[];
    newest: string | null;
    oldest: string | null;
    dated: number;
    recent90: number;
    thin: number | null;
    category: { url: string; status: number; words: number; links: number } | null;
  } | null;
}) {
  const scoreColor = report.probability >= 70 ? C.ok : report.probability >= 45 ? C.warn : C.risk;
  return (
    <Document
      title={`Ad Network Readiness Report - ${domain}`}
      author={siteName}
      subject={`${networkName(target)} approval readiness`}
    >
      {/* Cover */}
      <Page size="A4" style={s.page}>
        <View style={[s.brandBar, { marginHorizontal: -44, marginTop: -40 }]} fixed={false}>
          <View style={s.brandRow}>
            <Text style={s.brandName}>{siteName}</Text>
            <Text style={s.brandTag}>Ad network approval readiness</Text>
          </View>
        </View>

        <Text style={s.h1}>Approval Readiness Report</Text>
        <Text style={s.sub}>Prepared for {domain} on {date}</Text>

        <View style={s.metaRow}>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Target network</Text>
            <Text style={s.metaValue}>{networkName(target)}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Analysis mode</Text>
            <Text style={s.metaValue}>{mode.charAt(0) + mode.slice(1).toLowerCase()}{deep ? " + deep scan" : ""}</Text>
          </View>
          {summaryData ? (
            <>
              <View style={s.metaBox}>
                <Text style={s.metaLabel}>Pages found</Text>
                <Text style={s.metaValue}>{summaryData.pages}</Text>
              </View>
              <View style={s.metaBox}>
                <Text style={s.metaLabel}>Platform</Text>
                <Text style={s.metaValue}>{summaryData.platform || "Unknown"}</Text>
              </View>
            </>
          ) : null}
        </View>

        <View style={s.scoreCard}>
          <View style={{ marginRight: 20, alignItems: "center" }}>
            <Text style={[s.scoreNum, { color: scoreColor }]}>{report.probability}</Text>
            <Text style={s.scoreLabel}>approval probability</Text>
          </View>
          <View style={{ flex: 1 }}>
            <VerdictPill verdict={report.verdict} />
            <View style={s.barBg}>
              <View style={{ width: `${report.probability}%`, height: 8, backgroundColor: scoreColor, borderRadius: 4 }} />
            </View>
            <Text style={{ fontSize: 8, color: C.muted, marginTop: 6 }}>
              0 to 44 high risk · 45 to 69 needs improvement · 70 to 100 apply-ready
            </Text>
          </View>
        </View>

        {report.summary ? <Text style={s.summary}>{report.summary}</Text> : null}

        <Text style={s.h2}>Verdict at a glance</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 10 }}>
            <Text style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Strengths</Text>
            <Text style={{ fontSize: 20, fontWeight: 700, color: C.ok }}>{report.strengths?.length || 0}</Text>
          </View>
          <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 10 }}>
            <Text style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Risks</Text>
            <Text style={{ fontSize: 20, fontWeight: 700, color: C.warn }}>{report.risks?.length || 0}</Text>
          </View>
          <View style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 10 }}>
            <Text style={{ fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>Critical fixes</Text>
            <Text style={{ fontSize: 20, fontWeight: 700, color: C.risk }}>{report.criticalFixes?.length || 0}</Text>
          </View>
        </View>
        <Text style={s.footer} fixed>
          <Text>{siteName} · {domain}</Text>
          <Text>Page 1</Text>
        </Text>
      </Page>

      {/* Findings */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Detailed findings</Text>
        {(report.sections || []).map((sec, i) => <SectionBlock key={i} section={sec} />)}
        {deep && deepData && (deepData.nav.length > 0 || deepData.dated > 0 || deepData.category) ? (
          <View wrap={false} style={{ marginTop: 18 }}>
            <Text style={s.h2}>Deep scan evidence</Text>
            {deepData.nav.length > 0 && (
              <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 6 }}>
                {deepData.nav.map((p, i) => (
                  <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: i < deepData.nav.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                    <Text style={{ fontSize: 9.5, fontWeight: 700, textTransform: "capitalize" }}>{p.path} page</Text>
                    <Text style={{ fontSize: 9.5, color: p.hasContent ? C.ok : p.status === 200 ? C.warn : C.risk }}>
                      {p.status === 200 ? `${p.words.toLocaleString()} words${p.hasContent ? "" : " (thin)"}` : `HTTP ${p.status}`}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={{ fontSize: 9.5, color: C.muted, lineHeight: 1.5, marginTop: 8 }}>
              {deepData.dated > 0
                ? `Freshness: newest sampled post ${deepData.newest || "not dated"}, oldest ${deepData.oldest || "not dated"}; ${deepData.recent90} of ${deepData.dated} dated articles were published or updated in the last 90 days.`
                : "No publish dates were found in the sampled articles."}
              {deepData.thin !== null ? ` ${Math.round(deepData.thin * 100)}% of sampled articles are under 600 words.` : ""}
              {deepData.category ? ` Category page probe (${deepData.category.url}): HTTP ${deepData.category.status}, ${deepData.category.words.toLocaleString()} words, ${deepData.category.links} links.` : ""}
            </Text>
          </View>
        ) : null}
        <Text style={s.footer} fixed>
          <Text>{siteName} · {domain}</Text>
          <Text render={({ pageNumber }) => `Page ${pageNumber}`} />
        </Text>
      </Page>

      {/* Actions */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Strengths</Text>
        <ListBlock title="" items={report.strengths || []} color={C.ok} />
        <Text style={s.h2}>Risks</Text>
        <ListBlock title="" items={report.risks || []} color={C.warn} />
        <Text style={s.h2}>Critical fixes before applying</Text>
        <ListBlock title="" items={report.criticalFixes || []} color={C.risk} />
        <Text style={s.h2}>Fix-first roadmap</Text>
        {(report.roadmap || []).map((r, i) => (
          <View key={i} style={s.roadmapStep} wrap={false}>
            <Text style={s.stepNum}>{r.step}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 10, fontWeight: 700 }}>{r.title}</Text>
              <Text style={{ fontSize: 9.5, color: C.muted, lineHeight: 1.5, marginTop: 1 }}>{r.detail}</Text>
            </View>
          </View>
        ))}
        <View style={{ marginTop: 24, backgroundColor: C.primarySoft, borderRadius: 6, padding: 14 }} wrap={false}>
          <Text style={{ fontSize: 9.5, lineHeight: 1.6, color: C.ink }}>
            Disclaimer: this report is an independent, evidence-based assessment produced by {siteName}. It is not
            affiliated with or endorsed by {networkName(target)}. Approval decisions are made solely by the ad network.
          </Text>
        </View>
        <Text style={s.footer} fixed>
          <Text>{siteName} · {domain}</Text>
          <Text render={({ pageNumber }) => `Page ${pageNumber}`} />
        </Text>
      </Page>
    </Document>
  );
}

export async function buildAuditPdf(opts: {
  domain: string;
  target: string;
  mode: string;
  report: AuditReport;
  signals: unknown;
  siteName: string;
}): Promise<Buffer> {
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
  const sig = (opts.signals && typeof opts.signals === "object" ? opts.signals : null) as DeepSig | null;
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

  return renderToBuffer(
    <AuditPdfDoc
      domain={opts.domain}
      target={opts.target}
      mode={opts.mode}
      date={new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      report={opts.report}
      siteName={opts.siteName}
      summaryData={summaryData}
      deep={deep}
      deepData={deepData}
    />
  );
}
