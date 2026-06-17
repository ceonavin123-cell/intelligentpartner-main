// ============================================================
// ERROR MONITORING — Structured error logging
// Can be swapped with Sentry, Logtail, etc. later
// ============================================================

export interface ErrorContext {
  endpoint?: string;
  userId?: string;
  companyId?: string;
  requestId?: string;
  severity: "low" | "medium" | "high" | "critical";
  tags?: Record<string, string>;
}

export function reportError(error: Error | unknown, context: ErrorContext) {
  const err = error instanceof Error ? error : new Error(String(error));

  const logEntry = {
    timestamp: new Date().toISOString(),
    level: context.severity,
    message: err.message,
    stack: err.stack?.slice(0, 500),
    ...context,
  };

  // Structured log for log aggregators
  if (context.severity === "critical") {
    console.error("[CRITICAL]", JSON.stringify(logEntry));
  } else if (context.severity === "high") {
    console.error("[HIGH]", JSON.stringify(logEntry));
  } else {
    console.warn("[MONITOR]", JSON.stringify(logEntry));
  }

  // TODO: Send to Sentry/Logtail when configured
  // if (process.env.SENTRY_DSN) {
  //   Sentry.captureException(err, { extra: context });
  // }
}
