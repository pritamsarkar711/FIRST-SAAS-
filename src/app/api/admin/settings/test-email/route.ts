import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import nodemailer from "nodemailer";
import { requireAdmin } from "@/lib/admin-guard";
import { getSetting } from "@/lib/settings";
import { logActivity } from "@/lib/activity";

export const runtime = "nodejs";

const schema = z.object({ to: z.string().trim().email() });

/** Admin "send a test email" button: verifies the SMTP credentials above actually deliver. */
export async function POST(req: NextRequest) {
  const { user: admin, error } = await requireAdmin();
  if (error) return error;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const smtp = await getSetting("smtp", { host: "", port: 587, user: "", pass: "", from: "" });
  if (!smtp.host || !smtp.user || !smtp.pass) {
    return NextResponse.json({ ok: false, message: "SMTP is not configured yet. Fill in the host, user and password above and save first." });
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  });

  try {
    await transporter.sendMail({
      from: smtp.from || smtp.user,
      to: parsed.data.to,
      subject: "Audit Form test email",
      text: `This is a test email from your Audit Form SMTP settings. If you are reading this, outgoing email works.\n\nSent ${new Date().toISOString()}`,
      html: `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1b2620">
        <div style="border:1px solid #e2e8e4;border-radius:6px;padding:24px">
          <p style="margin:0 0 12px;font-size:18px;font-weight:bold">SMTP is working</p>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#5d6b64">This test email was sent from your Audit Form SMTP settings. Payment receipts, support replies and the weekly monitoring digest will all deliver through this connection.</p>
          <p style="margin:0;font-size:12px;color:#93a39a">Sent ${new Date().toISOString()}</p>
        </div>
      </div>`,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "The mail server rejected the connection.";
    logActivity({ action: "SMTP_TEST", actorEmail: admin.email, detail: `FAILED to ${parsed.data.to}: ${message.slice(0, 200)}` });
    return NextResponse.json({ ok: false, message: `Send failed: ${message}` });
  }

  logActivity({ action: "SMTP_TEST", actorEmail: admin.email, detail: `Test email delivered to ${parsed.data.to}` });
  return NextResponse.json({ ok: true, message: `Test email delivered to ${parsed.data.to}. Ask them to check spam if it does not appear.` });
}
