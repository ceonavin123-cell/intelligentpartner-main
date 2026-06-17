// ============================================================
// AUDIT LOG — Track security-relevant actions
// ============================================================

export interface AuditEvent {
  action: string;
  userId: string;
  companyId?: string;
  target?: string;
  details?: Record<string, any>;
  success: boolean;
}

const auditLog: AuditEvent[] = [];

// Keep last 1000 events in memory (for dev)
// In production: send to database or log aggregator
const MAX_EVENTS = 1000;

export function logAuditEvent(event: AuditEvent) {
  auditLog.push(event);
  if (auditLog.length > MAX_EVENTS) auditLog.shift();

  const status = event.success ? "✅" : "❌";
  console.log(
    `[AUDIT] ${status} ${event.action} user=${event.userId} ${event.companyId ? `company=${event.companyId}` : ""} ${event.target ?? ""}`,
  );
}

export function getAuditLog(limit = 50): AuditEvent[] {
  return auditLog.slice(-limit);
}
