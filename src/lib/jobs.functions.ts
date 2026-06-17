import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scrapeJobs } from "./jobs.server";

export const fetchJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const jobs = await scrapeJobs();
    return { jobs };
  });
