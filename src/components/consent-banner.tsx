import { useState, useEffect } from "react";
import { getStoredConsent, saveConsent, hasConsent } from "@/lib/gdpr-consent";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!hasConsent()) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleAcceptAll = () => {
    saveConsent({ necessary: true, analytics: true, marketing: true });
    setVisible(false);
  };

  const handleSave = () => {
    saveConsent({ necessary: true, analytics, marketing });
    setVisible(false);
  };

  const handleRejectOptional = () => {
    saveConsent({ necessary: true, analytics: false, marketing: false });
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <Card className="max-w-2xl mx-auto p-6 shadow-lg border">
        <h3 className="text-lg font-semibold mb-2">Cookie & Data Consent</h3>
        <p className="text-sm text-muted-foreground mb-4">
          We use cookies and collect data to provide our consulting platform services.
          You can choose which optional cookies to allow.
        </p>

        <div className="space-y-2 mb-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked disabled className="rounded" />
            <span><strong>Necessary</strong> — Required for the app to function (always on)</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={analytics}
              onChange={(e) => setAnalytics(e.target.checked)}
              className="rounded"
            />
            <span><strong>Analytics</strong> — Help us improve the platform</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => setMarketing(e.target.checked)}
              className="rounded"
            />
            <span><strong>Marketing</strong> — Personalized content and emails</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleAcceptAll} size="sm">Accept All</Button>
          <Button onClick={handleSave} size="sm" variant="outline">Save Preferences</Button>
          <Button onClick={handleRejectOptional} size="sm" variant="ghost">Reject Optional</Button>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          By using this platform, you agree to our{" "}
          <a href="/privacy" className="underline">Privacy Policy</a> and{" "}
          <a href="/terms" className="underline">Terms of Service</a>.
        </p>
      </Card>
    </div>
  );
}
