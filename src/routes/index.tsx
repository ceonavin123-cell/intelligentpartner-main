import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Consultant Studio" },
      {
        name: "description",
        content: "Multi-agent AI assistant for management consultants — CFO, COO, and Tax agents per client.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const router = useRouter();
  useEffect(() => {
    router.navigate({ to: "/dashboard" });
  }, [router]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
