import { db } from "@/lib/db";
import { getSetting, setSetting } from "@/lib/settings";
import { networkName } from "@/lib/audit-runner";

export const DIGEST_DEFAULTS = { enabled: false, lastSentAt: "" };
const WEEK_MS = 7 * 24 * 60 * 60_000;

interface WatchRow {
  domain: string;
  target: string;
  mode?: string;
  deepScan: boolean;
  intervalDays: number;
  active: boolean;
  lastScore: number | null;
  nextRunAt: Date;
  runs: number;
  pausedReason: string | null;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function fmtIn(ms: number): string {
  const days = Math.ceil(ms / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function scoreWord(score: number | null): string {
  if (score === null) return "no check yet";
  if (score >= 70) return `${score}% (apply-ready)`;
  if (score >= 45) return `${score}% (needs work)`;
  return `${score}% (high risk)`;
}

function buildHtml(rows: WatchRow[], siteName: string): string {
  const list = rows
    .map((r) => {
      const color = r.lastScore === null ? "#6b7280" : r.lastScore >= 70 ? "#0d6b4d" : r.lastScore >= 45 ? "#b45309" : "#b91c1c";
      const state = r.active ? `next check ${fmtIn(r.nextRunAt.getTime() - Date.now())}` : "paused";
      const note = r.pausedReason ? `<br/><span style="color:#b45309">${r.pausedReason}</span>` : "";
      const deep = r.deepScan ? ` <span style="color:#0d6b4d;font-weight:700">· deep scan</span>` : "";
      return `<tr>
  <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">
    <strong>${r.domain}</strong><br/>
    <span style="color:#6b7280;font-size:13px">${networkName(r.target)} · every ${r.intervalDays} days · ${state}${deep}</span>${note}
  </td>
  <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;color:${color};font-weight:700;white-space:nowrap">${scoreWord(r.lastScore)}</td>
</tr>`;
    })
    .join("");
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
  <h2 style="font-size:18px;margin:0 0 6px">${siteName} monitoring digest</h2>
  <p style="font-size:14px;color:#6b7280;margin:0 0 16px">Your monitored domains and where their approval odds stand this week.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">${list}</table>
  <p style="font-size:13px;color:#6b7280;margin:16px 0 0">Run a check any time from your dashboard, or open a report to see every finding in detail.</p>
</div>`;
}

function buildText(rows: WatchRow[], siteName: string): string {
  return [
    `${siteName} monitoring digest`,
    "",
    ...rows.map((r) => {
      const state = r.active ? `next check ${fmtIn(r.nextRunAt.getTime() - Date.now())}` : "paused";
      const note = r.pausedReason ? ` [${r.pausedReason}]` : "";
      const deep = r.deepScan ? " · deep scan" : "";
      return `- ${r.domain} (${networkName(r.target)}, every ${r.intervalDays} days, ${state}${deep}): ${scoreWord(r.lastScore)}${note}`;
    }),
    "",
    "Run a check any time from your dashboard.",
  ].join("\n");
}

/**
 * Weekly digest of monitoring results, sent per user when SMTP is configured.
 * Called after the automation tick; the 7-day cadence is enforced globally via
 * the digestLastSentAt setting so a frequently-hit cron does not spam users.
 * force=true (admin "send now") bypasses the cadence but still requires SMTP.
 */
export async function maybeSendDigests(opts: { force?: boolean } = {}): Promise<{ sent: number; skipped: string; enabled: boolean }> {
  const cfg = await getSetting<{ enabled: boolean; lastSentAt: string }>("monitorDigest", DIGEST_DEFAULTS);
  if (!cfg.enabled) return { sent: 0, skipped: "Digest is disabled in admin settings.", enabled: false };

  if (!opts.force) {
    const last = cfg.lastSentAt ? new Date(cfg.lastSentAt).getTime() : 0;
    if (Date.now() - last < WEEK_MS) {
      return { sent: 0, skipped: "Next digest is not due yet.", enabled: true };
    }
  }

  const smtp = await getSetting("smtp", { host: "", port: 587, user: "", pass: "", from: "" });
  if (!smtp.host || !smtp.user || !smtp.pass) {
    return { sent: 0, skipped: "SMTP is not configured, so no email could be sent.", enabled: true };
  }

  const site = await getSetting("site", { name: "AdAudit" });
  const nodemailer = await import("nodemailer").catch(() => null);
  if (!nodemailer) return { sent: 0, skipped: "Mailer unavailable on this host.", enabled: true };
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  // One digest per user who has monitoring items; include paused rows so the
  // owner learns why a monitor stopped checking.
  const users = await db.user.findMany({
    where: { watchItems: { some: {} }, status: "ACTIVE" },
    select: { id: true, email: true, name: true, watchItems: { orderBy: { createdAt: "asc" } } },
  });

  let sent = 0;
  for (const user of users) {
    const rows: WatchRow[] = user.watchItems.map((w) => ({
      domain: w.domain,
      target: w.target,
      deepScan: w.deepScan,
      intervalDays: w.intervalDays,
      active: w.active,
      lastScore: w.lastScore,
      nextRunAt: w.nextRunAt,
      runs: w.runs,
      pausedReason: w.pausedReason,
    }));
    if (rows.length === 0) continue;
    const html = buildHtml(rows, site.name || "AdAudit");
    try {
      await transport.sendMail({
        from: smtp.from || smtp.user,
        to: user.email,
        subject: `${site.name || "AdAudit"} weekly monitoring digest (${rows.length} domain${rows.length === 1 ? "" : "s"})`,
        text: buildText(rows, site.name || "AdAudit"),
        html,
      });
      sent += 1;
    } catch {
      // Per-user failure is non-fatal; the rest still get theirs.
    }
  }

  await setSetting("monitorDigest", { ...cfg, lastSentAt: new Date().toISOString() });
  return { sent, skipped: sent === 0 ? "No digest recipients had monitors to report." : "", enabled: true };
}
