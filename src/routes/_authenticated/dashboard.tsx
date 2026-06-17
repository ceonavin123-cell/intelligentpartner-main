import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createCompany, listCompanies, runCompanyResearch } from "@/lib/companies.functions";
import { fetchJobs } from "@/lib/jobs.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Building2,
  Plus,
  ArrowRight,
  Briefcase,
  Mail,
  Globe,
  MapPin,
  DollarSign,
  RefreshCw,
  ExternalLink,
  BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const qc = useQueryClient();
  const list = useServerFn(listCompanies);
  const create = useServerFn(createCompany);
  const research = useServerFn(runCompanyResearch);
  const { data, isLoading } = useQuery({ queryKey: ["companies"], queryFn: () => list() });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", website: "", industry: "" });
  const [submitting, setSubmitting] = useState(false);

  const startResearchAndOpen = async (payload: { name: string; website?: string; industry?: string }) => {
    const res = await create({ data: payload });
    const company = (res as any).company;
    qc.invalidateQueries({ queryKey: ["companies"] });
    research({ data: { companyId: company.id } })
      .then(() => {
        toast.success(`Research complete for ${company.name}`);
        qc.invalidateQueries({ queryKey: ["companies"] });
        qc.invalidateQueries({ queryKey: ["company", company.id] });
      })
      .catch((err: any) => toast.error(`Research failed: ${err?.message ?? "unknown"}`));
    router.navigate({ to: "/companies/$id", params: { id: company.id } });
    return company;
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await startResearchAndOpen(form);
      toast.success("Company added. Agents are now researching…");
      setOpen(false);
      setForm({ name: "", website: "", industry: "" });
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create company");
    } finally {
      setSubmitting(false);
    }
  };

  const companies = (data as any)?.companies ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your clients</h1>
          <p className="text-sm text-muted-foreground">
            Add a company or pull prospects from job boards.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/manual">
              <BookOpen className="h-4 w-4 mr-2" /> User manual
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Add company
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a client company</DialogTitle>
            </DialogHeader>
            <form onSubmit={onCreate} className="space-y-3">
              <div className="space-y-1">
                <Label>Company name</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Acme Inc."
                />
              </div>
              <div className="space-y-1">
                <Label>Website</Label>
                <Input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://acme.com"
                />
              </div>
              <div className="space-y-1">
                <Label>Industry (optional)</Label>
                <Input
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  placeholder="SaaS, Manufacturing, Retail…"
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Adding…" : "Add & start research"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="companies">
        <TabsList>
          <TabsTrigger value="companies">
            <Building2 className="h-4 w-4 mr-1.5" /> Companies
          </TabsTrigger>
          <TabsTrigger value="scraping">
            <Briefcase className="h-4 w-4 mr-1.5" /> Web Scraping
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies" className="mt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : companies.length === 0 ? (
            <Card className="p-8 text-center">
              <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="mt-3 text-sm text-muted-foreground">
                No clients yet. Add your first company to get started.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {companies.map((c: any) => (
                <Link key={c.id} to="/companies/$id" params={{ id: c.id }} className="block">
                  <Card className="p-5 hover:border-primary transition-colors">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{c.name}</h3>
                        {c.website && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {c.website}
                          </p>
                        )}
                      </div>
                      <Badge variant={c.status === "ready" ? "default" : "secondary"}>
                        {c.status}
                      </Badge>
                    </div>
                    {c.industry && (
                      <p className="text-xs text-muted-foreground mt-2">{c.industry}</p>
                    )}
                    <div className="mt-4 flex items-center text-sm text-primary">
                      Open workspace <ArrowRight className="h-3 w-3 ml-1" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="scraping" className="mt-6">
          <JobsPanel onOpenWorkspace={startResearchAndOpen} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function JobsPanel({
  onOpenWorkspace,
}: {
  onOpenWorkspace: (p: { name: string; website?: string; industry?: string }) => Promise<any>;
}) {
  const fetchJobsFn = useServerFn(fetchJobs);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const { data, isFetching, refetch, error } = useQuery({
    queryKey: ["scraped-jobs"],
    queryFn: () => fetchJobsFn(),
    enabled: false,
  });

  const jobs: any[] = (data as any)?.jobs ?? [];

  const handleOpen = async (job: any) => {
    const key = `${job.company}-${job.title}`;
    setBusyKey(key);
    try {
      await onOpenWorkspace({
        name: job.company || job.title,
        website: job.website || undefined,
        industry: "Job posting (Nepal)",
      });
      toast.success("Workspace opened — research running");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to open workspace");
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Top jobs — Merojob & JobsNepal</h2>
          <p className="text-xs text-muted-foreground">
            Accounting · Finance · Operations · Management Consultant · Business Automation
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          {isFetching ? "Scraping…" : data ? "Refresh" : "Scrape jobs"}
        </Button>
      </div>

      {error ? (
        <Card className="p-4 text-sm text-destructive">
          {(error as any)?.message ?? "Failed to fetch jobs"}
        </Card>
      ) : null}

      {!data && !isFetching ? (
        <Card className="p-8 text-center">
          <Briefcase className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Click <strong>Scrape jobs</strong> to pull the latest 30 relevant postings.
          </p>
        </Card>
      ) : null}

      {isFetching ? (
        <p className="text-sm text-muted-foreground">Scraping job boards… this can take 30–60s.</p>
      ) : null}

      {jobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((j, i) => {
            const key = `${j.company}-${j.title}-${i}`;
            return (
              <Card key={key} className="p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold leading-tight">{j.title}</h3>
                    <p className="text-sm text-muted-foreground truncate">{j.company}</p>
                  </div>
                  <Badge variant="secondary">{j.source}</Badge>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {j.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3" /> <span className="truncate">{j.email}</span>
                    </div>
                  )}
                  {j.website && (
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3 w-3" />{" "}
                      <a
                        href={j.website}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate hover:text-primary"
                      >
                        {j.website}
                      </a>
                    </div>
                  )}
                  {j.address && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3" /> <span className="truncate">{j.address}</span>
                    </div>
                  )}
                  {j.salary && (
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3 w-3" /> <span>{j.salary}</span>
                    </div>
                  )}
                  {j.source_url && (
                    <a
                      href={j.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      View posting <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                <Button
                  size="sm"
                  className="mt-auto"
                  onClick={() => handleOpen(j)}
                  disabled={busyKey === `${j.company}-${j.title}`}
                >
                  {busyKey === `${j.company}-${j.title}`
                    ? "Opening…"
                    : "Open workspace & run agents"}
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Card>
            );
          })}
        </div>
      ) : null}

      {data && jobs.length === 0 && !isFetching ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No relevant jobs found. Try again in a moment.
        </Card>
      ) : null}
    </div>
  );
}
