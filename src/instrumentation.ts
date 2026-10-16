/**
 * Next.js instrumentation - runs once when the server process boots.
 *
 * Hostinger shared hosting runs this app under a long-lived single process.
 * A single unhandled rejection (e.g. a lazy-loaded module failing to resolve)
 * used to take the whole site down with LiteSpeed returning 503. These guards
 * keep the server alive and log the reason instead of crashing.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("unhandledRejection", (reason) => {
      console.error(
        "[unhandledRejection-guard] kept the server alive. Reason:",
        reason instanceof Error ? `${reason.message}\n${reason.stack}` : reason,
      );
    });
    process.on("uncaughtException", (err) => {
      console.error(
        "[uncaughtException-guard] kept the server alive. Error:",
        err instanceof Error ? `${err.message}\n${err.stack}` : err,
      );
    });
  }
}
