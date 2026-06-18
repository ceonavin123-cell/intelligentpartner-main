import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Zap, DollarSign, BarChart2, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_authenticated/usage")({
  component: UsageDashboard,
});

const getUsageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, token_used, token_limit")
      .order("token_used", { ascending: false });
    const totalTokensUsed = (companies ?? []).reduce((sum: number, c: any) => sum + (c.token_used ?? 0), 0);
    const estimatedCost = (totalTokensUsed / 1_000_000) * 0.165;
    const { count: memoryCount } = await supabase.from("semantic_memories").select("id", { count: "exact", head: true });
    const { count: graphCount } = await supabase.from("knowledge_graph").select("id", { count: "exact", head: true });
    const { count: chunkCount } = await supabase.from("document_chunks").select("id", { count: "exact", head: true });
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentMessages } = await supabase.from("chat_messages").select("id", { count: "exact", head: true }).gte("created_at", weekAgo);
    return { companies: companies ?? [], totalTokensUsed, estimatedCost, memoryCount: memoryCount ?? 0, graphCount: graphCount ?? 0, chunkCount: chunkCount ?? 0, recentMessages: recentMessages ?? 0 };
  });

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${(cost * 100).toFixed(4)}¢`;
  return `$${cost.toFixed(4)}`;
}
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}
function getUsageColor(pct: number): string {
  if (pct >= 90) return "text-red-500";
  if (pct >= 70) return "text-amber-500";
  return "text-emerald-500";
}
function getUsageBg(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

function UsageDashboard() {
  const getStats = useServerFn(getUsageStats);
  const { data, isLoading } = useQuery({ queryKey: ["usage-stats"], queryFn: () => getStats(), refetchInterval: 30_000 });
  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="text-sm text-muted-foreground animate-pulse">Loading usage data...</div></div>;
  const stats = data as any;
  const totalTokens = stats?.totalTokensUsed ?? 0;
  const estimatedCost = stats?.estimatedCost ?? 0;
  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">API Usage Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Gemini API token usage and estimated costs across all companies</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Zap className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground uppercase tracking-wide">Total Tokens</span></div>
          <div className="text-2xl font-bold">{formatTokens(totalTokens)}</div>
          <div className="text-xs text-muted-foreground mt-1">across all companies</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><DollarSign className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground uppercase tracking-wide">Est. Cost</span></div>
          <div className="text-2xl font-bold">{formatCost(estimatedCost)}</div>
          <div className="text-xs text-muted-foreground mt-1">Gemini 2.5 Flash pricing</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><BarChart2 className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground uppercase tracking-wide">Messages (7d)</span></div>
          <div className="text-2xl font-bold">{stats?.recentMessages ?? 0}</div>
          <div className="text-xs text-muted-foreground mt-1">last 7 days</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-violet-500" /><span className="text-xs text-muted-foreground uppercase tracking-wide">Avg per Message</span></div>
          <div className="text-2xl font-bold">{stats?.recentMessages > 0 ? formatTokens(Math.round(totalTokens / stats.recentMessages)) : "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">tokens per message</div>
        </Card>
      </div>
      <Card className="p-5">
        <h2 className="font-semibold text-sm mb-4">🧠 AI Knowledge Base</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center"><div className="text-3xl font-bold text-blue-500">{stats?.chunkCount ?? 0}</div><div className="text-xs text-muted-foreground mt-1">RAG Chunks</div></div>
          <div className="text-center"><div className="text-3xl font-bold text-violet-500">{stats?.graphCount ?? 0}</div><div className="text-xs text-muted-foreground mt-1">Graph Nodes</div></div>
          <div className="text-center"><div className="text-3xl font-bold text-emerald-500">{stats?.memoryCount ?? 0}</div><div className="text-xs text-muted-foreground mt-1">Memory Items</div></div>
        </div>
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold text-sm mb-4">📊 Usage by Company</h2>
        {(stats?.companies ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No companies found.</p> : (
          <div className="space-y-4">
            {(stats?.companies ?? []).map((company: any) => {
              const used = company.token_used ?? 0;
              const limit = company.token_limit ?? 100000;
              const pct = Math.min(100, Math.round((used / limit) * 100));
              const cost = (used / 1_000_000) * 0.165;
              return (
                <div key={company.id} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{company.name}</span>
                      {pct >= 90 && <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Near limit</Badge>}
                      {pct < 50 && <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500"><CheckCircle2 className="h-3 w-3 mr-1" />Healthy</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className={getUsageColor(pct)}>{pct}%</span>
                      <span>{formatTokens(used)} / {formatTokens(limit)}</span>
                      <span className="text-emerald-600 font-medium">{formatCost(cost)}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${getUsageBg(pct)}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
      <Card className="p-5 bg-muted/30">
        <h2 className="font-semibold text-sm mb-3">💡 Gemini 2.5 Flash Pricing</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><div className="font-medium text-muted-foreground">Input tokens</div><div className="text-base font-bold mt-1">$0.075<span className="text-muted-foreground font-normal">/1M</span></div></div>
          <div><div className="font-medium text-muted-foreground">Output tokens</div><div className="text-base font-bold mt-1">$0.30<span className="text-muted-foreground font-normal">/1M</span></div></div>
          <div><div className="font-medium text-muted-foreground">Avg blended rate</div><div className="text-base font-bold mt-1">~$0.165<span className="text-muted-foreground font-normal">/1M</span></div></div>
          <div><div className="font-medium text-muted-foreground">Free tier</div><div className="text-base font-bold mt-1 text-emerald-500">1M/day</div></div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Cost estimates are approximate. Check actual usage at <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="underline">aistudio.google.com</a></p>
      </Card>
    </div>
  );
}
