// ============================================================
// GDPR CONSENT — Cookie & data consent management
// ============================================================

export interface ConsentPreferences {
  necessary: boolean;    // Always true (required for app to function)
  analytics: boolean;    // Google Analytics, etc.
  marketing: boolean;    // Email marketing, ads
  consentedAt: string;   // ISO date
  version: string;       // Consent version for re-consent on policy changes
}

const CONSENT_VERSION = "1.0";
const STORAGE_KEY = "ip_consent";

export function getStoredConsent(): ConsentPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentPreferences;
    // Re-consent if version changed
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveConsent(prefs: Omit<ConsentPreferences, "consentedAt" | "version">): ConsentPreferences {
  const full: ConsentPreferences = {
    ...prefs,
    necessary: true, // Always required
    consentedAt: new Date().toISOString(),
    version: CONSENT_VERSION,
  };
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  }
  return full;
}

export function hasConsent(): boolean {
  return getStoredConsent() !== null;
}

export function hasAnalyticsConsent(): boolean {
  return getStoredConsent()?.analytics ?? false;
}

export function revokeConsent(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
