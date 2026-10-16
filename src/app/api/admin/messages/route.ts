import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;
  const messages = await db.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ messages });
}

const schema = z.object({
  id: z.string().min(1),
  action: z.enum(["reply", "close"]),
  reply: z.string().max(4000).optional(),
});

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid action." }, { status: 400 });

  const msg = await db.contactMessage.findUnique({ where: { id: parsed.data.id } });
  if (!msg) return NextResponse.json({ error: "Message not found." }, { status: 404 });

  if (parsed.data.action === "reply") {
    await db.contactMessage.update({
      where: { id: msg.id },
      data: { reply: parsed.data.reply || "", status: "REPLIED", repliedAt: new Date() },
    });
    // Email the reply if SMTP is configured (gracefully skipped otherwise)
    try {
      const { getSetting, SMTP_DEFAULTS } = await import("@/lib/settings");
      const smtp = await getSetting("smtp", SMTP_DEFAULTS);
      if (smtp.host && smtp.user && smtp.pass && parsed.data.reply) {
        const nodemailer = await import("nodemailer").catch(() => null);
        if (nodemailer) {
          const transport = nodemailer.createTransport({
            host: smtp.host, port: smtp.port, secure: smtp.port === 465,
            auth: { user: smtp.user, pass: smtp.pass },
          });
          await transport.sendMail({
            from: smtp.from || smtp.user,
            to: msg.email,
            subject: `Re: ${msg.reason} — AdAudit support`,
            text: parsed.data.reply,
          });
        }
      }
    } catch { /* SMTP errors are non-fatal; reply is stored in the panel */ }
    return NextResponse.json({ ok: true });
  }

  await db.contactMessage.update({ where: { id: msg.id }, data: { status: "CLOSED" } });
  return NextResponse.json({ ok: true });
}
