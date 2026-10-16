import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { approvePaymentById } from "@/lib/payments";
import { rateLimit, clientIp } from "@/lib/credits";
import { logActivity } from "@/lib/activity";

/**
 * SSLCommerz return endpoint. The buyer lands here from the SSLCommerz hosted
 * page with our query (?payment=<id>&result=success|fail) plus SSLCommerz's own
 * params appended (val_id, amount, tran_id, status...). We re-validate the
 * transaction server-side against SSLCommerz's Validation API, confirm the
 * tran_id and amount, then run the shared approval flow and redirect the buyer
 * to the result page.
 */
async function validateAndFinalize(paymentId: string): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.gateway !== "sslcommerz") {
    return { ok: false, error: "This payment is not an SSLCommerz order.", status: 404 };
  }
  if (payment.status === "APPROVED") return { ok: true };
  if (payment.status === "REJECTED") {
    return { ok: false, error: "This order was already rejected. Contact support.", status: 400 };
  }

  const gw = await db.gatewayConfig.findUnique({ where: { code: "sslcommerz" } });
  if (!gw) return { ok: false, error: "SSLCommerz is not configured right now.", status: 400 };

  let base = "https://sandbox.sslcommerz.com";
  let storeId = "";
  let storePassword = "";
  try {
    const cfg = JSON.parse(gw.config || "{}") as { store_id?: string; store_password?: string; env?: string };
    if (cfg.env === "live") base = "https://securepay.sslcommerz.com";
    storeId = cfg.store_id || "";
    storePassword = cfg.store_password || "";
  } catch { /* empty config */ }
  if (!storeId || !storePassword) {
    return { ok: false, error: "SSLCommerz is not configured right now.", status: 400 };
  }

  const valId = payment.txId || "";
  if (!valId) {
    return { ok: false, error: "No SSLCommerz validation reference was returned. Payment not completed.", status: 400 };
  }

  let valid = false;
  let amountPaid = "";
  let tranId = "";
  try {
    const params = new URLSearchParams({
      val_id: valId,
      store_id: storeId,
      store_passwd: storePassword,
      format: "json",
    });
    const res = await fetch(`${base}/validator/api/validationserverAPI.php?${params.toString()}`, {
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => ({}))) as
      | { status?: string; amount?: string; currency?: string; tran_id?: string }
      | Array<{ status?: string; amount?: string; currency?: string; tran_id?: string }>;
    const row = Array.isArray(data) ? data[0] : data;
    if (res.ok && row && (row.status === "VALID" || row.status === "VALIDATED")) {
      valid = true;
      amountPaid = row.amount || "";
      tranId = row.tran_id || "";
    }
  } catch {
    return { ok: false, error: "Could not reach SSLCommerz to confirm the payment. Refresh to retry.", status: 502 };
  }

  if (!valid) {
    return { ok: false, error: "SSLCommerz reports this transaction is not valid. Payment not completed.", status: 400 };
  }
  if (tranId && tranId !== paymentId) {
    logActivity({ action: "SSLCZ_MISMATCH", actorEmail: "sslcommerz", userId: payment.userId, detail: `Validation tran_id ${tranId} does not match order ${paymentId}` });
    return { ok: false, error: "The SSLCommerz transaction belongs to a different order reference. Contact support.", status: 400 };
  }
  const expected = payment.amount.toFixed(2);
  if (amountPaid && Number(amountPaid) + 0.001 < Number(expected)) {
    logActivity({ action: "SSLCZ_MISMATCH", actorEmail: "sslcommerz", userId: payment.userId, detail: `Amount paid ${amountPaid} below order ${expected} USD` });
    return { ok: false, error: "The paid amount does not match the order total. Contact support.", status: 400 };
  }

  await db.payment.update({
    where: { id: payment.id },
    data: {
      meta: JSON.stringify({ gatewayName: "SSLCommerz", mode: "API", sslValId: valId, sslAmountPaid: amountPaid || null }),
    },
  }).catch(() => {});

  const result = await approvePaymentById(payment.id, `sslcommerz:${valId.slice(0, 28)}`);
  if (!result.ok && result.reason !== "ALREADY_PROCESSED") {
    return { ok: false, error: "Payment verified but could not be applied. Contact support with this reference.", status: 500 };
  }
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
  if (!rateLimit(`sslczverify:${clientIp(req)}`, 12, 5 * 60_000).ok) {
    return NextResponse.redirect(new URL("/dashboard/billing", req.nextUrl.origin));
  }
  const user = await db.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));

  const paymentId = req.nextUrl.searchParams.get("payment");
  const resultParam = req.nextUrl.searchParams.get("result");
  if (!paymentId) {
    return NextResponse.redirect(new URL("/dashboard/billing", req.nextUrl.origin));
  }

  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.userId !== user.id) {
    return NextResponse.redirect(new URL("/dashboard/billing", req.nextUrl.origin));
  }

  // Buyer hit the fail_url, or SSLCommerz appended a failing status.
  if (resultParam === "fail" && payment.status === "PENDING") {
    await db.payment.update({ where: { id: paymentId }, data: { status: "REJECTED", note: "SSLCommerz reported the payment failed." } }).catch(() => {});
    return NextResponse.redirect(new URL(`/dashboard/billing/checkout/success?payment=${paymentId}&scz=1&failed=1&reason=${encodeURIComponent("SSLCommerz reported the payment failed. No charge was made.")}`, req.nextUrl.origin));
  }

  // SSLCommerz appends val_id to the return URL; store it for server-side validation.
  const valId = req.nextUrl.searchParams.get("val_id");
  if (valId && payment.status === "PENDING") {
    await db.payment.update({ where: { id: paymentId }, data: { txId: valId } }).catch(() => {});
  }

  const outcome = await validateAndFinalize(paymentId);
  if (outcome.ok) {
    logActivity({ action: "SSLCZ_VERIFY", actorEmail: user.email, userId: user.id, detail: `val_id ${(valId || payment.txId || "").slice(0, 24)}… validated and approved` });
    return NextResponse.redirect(new URL(`/dashboard/billing/checkout/success?payment=${paymentId}&scz=1&approved=1`, req.nextUrl.origin));
  }
  const note = encodeURIComponent(outcome.error.slice(0, 180));
  return NextResponse.redirect(new URL(`/dashboard/billing/checkout/success?payment=${paymentId}&scz=1&failed=1&reason=${note}`, req.nextUrl.origin));
}
