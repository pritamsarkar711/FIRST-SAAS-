import { db } from "@/lib/db";

export type ActivityAction =
  | "AUTH_LOGIN"
  | "AUTH_LOGIN_FAILED"
  | "AUTH_2FA_CHALLENGE"
  | "AUTH_REGISTER"
  | "AUTH_LOGOUT"
  | "AUTH_PASSWORD_CHANGE"
  | "AUTH_2FA_ENABLE"
  | "AUTH_2FA_DISABLE"
  | "AUDIT_START"
  | "AUDIT_BATCH_START"
  | "AUDIT_DELETE"
  | "AUDIT_SHARE"
  | "WRITER_START"
  | "INDEXER_SUBMIT"
  | "CHECKOUT_SUBMIT"
  | "PAYMENT_APPROVE"
  | "PAYMENT_REJECT"
  | "USER_CREDITS_ADJUST"
  | "USER_SUSPEND"
  | "USER_UNSUSPEND"
  | "USER_DELETE"
  | "USER_ROLE_CHANGE"
  | "ADMIN_LOGIN"
  | "PLAN_SAVE"
  | "GATEWAY_SAVE"
  | "SETTINGS_SAVE"
  | "BLOG_PUBLISH"
  | "WITHDRAW_REQUEST"
  | "WITHDRAW_APPROVE"
  | "WITHDRAW_REJECT"
  | "WITHDRAW_COMPLETE";

/**
 * Fire-and-forget audit trail writer. Never throws into the caller path;
 * a logging failure must not break the user-facing action.
 */
export function logActivity(entry: {
  action: ActivityAction;
  actorEmail: string;
  userId?: string | null;
  detail?: string;
  ip?: string | null;
}): void {
  void db.activityLog
    .create({
      data: {
        action: entry.action,
        actorEmail: entry.actorEmail.slice(0, 320),
        userId: entry.userId ?? null,
        detail: entry.detail?.slice(0, 500) ?? null,
        ip: entry.ip ?? null,
      },
    })
    .catch(() => {});
}
