import { db } from "@/lib/db";

export type NotificationType = "AUDIT" | "PAYMENT" | "WITHDRAWAL" | "MESSAGE" | "SYSTEM";

/** Fire-and-forget in-app notification. Never throws into caller flows. */
export async function notify(userId: string, type: NotificationType, title: string, body: string, link?: string): Promise<void> {
  try {
    await db.notification.create({ data: { userId, type, title, body, link: link || null } });
  } catch (e) {
    console.error("notify failed", e instanceof Error ? e.message : e);
  }
}
