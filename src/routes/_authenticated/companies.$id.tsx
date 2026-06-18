import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCompanyDetails, runCompanyResearch, updateCompanyTokenLimit, resetCompanyTokenUsage } from "@/lib/companies.functions";
import { createThread, listThreadMessages, sendChatMessage } from "@/lib/chat.functions";
import { generateStructuredReport, type ReportKind } from "@/lib/reports.functions";
import { listReportTemplates, deleteReportTemplate } from "@/lib/templates.functions";
import { uploadCompanyDocument, deleteCompanyDocument } from "@/lib/documents.functions";
import { getCompanyMemory } from "@/lib/memory.functions";
import { MemoryDashboard } from "@/components/MemoryDashboard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ArrowLeft, Brain, Send, RefreshCw, FileText, Plus, Sparkles, Download, Paperclip, Trash2, X, Mic, MicOff, Volume2, VolumeX, Coins, BookOpen, HelpCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, RadialBarChart, RadialBar, FunnelChart, Funnel, LabelList, Legend,
} from "recharts";
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle, CheckCircle2, Target, Zap, DollarSign, Rocket, Shield, Lightbulb, Trophy, Flame,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/companies/$id")({
  component: CompanyWorkspace,
});

const AGENT_META: Record<string, { name: string; color: string; emoji: string }> = {
  cfo: { name: "CFO", color: "bg-blue-500", emoji: "💰" },
  coo: { name: "COO", color: "bg-emerald-500", emoji: "⚙️" },
  tax: { name: "Tax", color: "bg-amber-500", emoji: "📋" },
  marketing: { name: "Marketing", color: "bg-pink-500", emoji: "📣" },
  bizdev: { name: "BizDev", color: "bg-violet-500", emoji: "🤝" },
};

const CHART_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

function CompanyWorkspace() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchDetails = useServerFn(getCompanyDetails);
  const research = useServerFn(runCompanyResearch);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["company", id],
    queryFn: () => fetchDetails({ data: { id } }),
    refetchInterval: (q) => {
      const c: any = (q.state.data as any)?.company;
      return c?.status === "researching" ? 4000 : false;
    },
  });

  const [rerunning, setRerunning] = useState(false);
  const onRerun = async () => {
    setRerunning(true);
    try {
      await research({ data: { companyId: id } });
      toast.success("Research refreshed");
      qc.invalidateQueries({ queryKey: ["company", id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setRerunning(false);
    }
  };

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading workspace…</p>;
  }

  const { company, assessments, sources, reports, threads, documents = [] } = data as any;

  const printReport = (elementId: string, title: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const original = document.title;
    document.title = title;
    document.body.setAttribute("data-print-target", elementId);
    el.setAttribute("data-print-target-match", "");
    const cleanup = () => {
      document.body.removeAttribute("data-print-target");
      el.removeAttribute("data-print-target-match");
      document.title = original;
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => window.print(), 50);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center">
            <ArrowLeft className="h-3 w-3 mr-1" /> All clients
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-2">{company.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            {company.website && (
              <a
                href={company.website}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:underline"
              >
                {company.website}
              </a>
            )}
            {company.industry && <Badge variant="outline">{company.industry}</Badge>}
            <Badge variant={company.status === "ready" ? "default" : "secondary"}>
              {company.status}
            </Badge>
          </div>
        </div>
        <Button variant="outline" onClick={onRerun} disabled={rerunning || company.status === "researching"}>
          <RefreshCw className={`h-4 w-4 mr-2 ${rerunning ? "animate-spin" : ""}`} />
          Re-run research
        </Button>
      </div>

      <Tabs defaultValue="assessment">
          <TabsList>
          <TabsTrigger value="assessment">Assessment</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
          <TabsTrigger value="reports">Reports ({reports.length})</TabsTrigger>
          <TabsTrigger value="sources">Sources ({sources.length})</TabsTrigger>
          <TabsTrigger value="memory" className="gap-1 flex items-center">
            <Brain className="h-3.5 w-3.5" /> Intelligence
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1 flex items-center">
            <BookOpen className="h-3.5" /> Manual
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assessment" className="space-y-4 mt-4">
          {assessments.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              Research has not started yet.
            </Card>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(["cfo", "coo", "tax", "marketing", "bizdev"] as const).map((agent) => {
              const a = assessments.find((x: any) => x.agent === agent);
              const meta = AGENT_META[agent];
              return (
                <Card key={agent} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`h-8 w-8 rounded-full ${meta.color} flex items-center justify-center text-white text-sm`}>
                        {meta.emoji}
                      </div>
                      <h3 className="font-semibold text-sm">{meta.name} Agent</h3>
                    </div>
                    {a?.risk_score != null && <Badge variant="outline">Risk {a.risk_score}</Badge>}
                  </div>
                  {!a ? (
                    <p className="text-xs text-muted-foreground">Not started</p>
                  ) : a.status === "running" ? (
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Brain className="h-3 w-3 mr-1 animate-pulse" /> Researching…
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">{a.summary}</p>
                      <AgentFindings findings={a.findings} />
                    </>
                  )}
                </Card>
              );
            })}
          </div>

          {assessments.length > 0 && <RiskOverview assessments={assessments} />}
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <ChatPanel company={company} threads={threads} documents={documents} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-4">
          <ReportGenerator companyId={id} />
          {reports.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No reports yet. Generate a Pre-Audit Report above, or ask the chat for a custom deliverable.
            </Card>
          ) : (
            reports.map((r: any) => (
              <Card key={r.id} id={`report-${r.id}`} className="report-printable overflow-hidden border-2">
                <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 py-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold leading-tight">{r.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()} · {(r.agents_involved ?? []).join(" · ") || "orchestrator"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 no-print">
                    <Badge variant="outline" className="uppercase tracking-wide">{r.type}</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => printReport(`report-${r.id}`, r.title)}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" /> PDF
                    </Button>
                  </div>
                </div>
                <div className="p-6 report-body">
                  <RichReport content={r.content} />
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sources" className="mt-4 space-y-2">
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sources collected yet.</p>
          ) : (
            sources.map((s: any) => (
              <Card key={s.id} className="p-3">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-medium text-sm hover:underline">
                  {s.title || s.url}
                </a>
                <p className="text-xs text-muted-foreground truncate">{s.url}</p>
                {s.excerpt && <p className="text-xs mt-1 text-muted-foreground line-clamp-2">{s.excerpt}</p>}
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="memory" className="mt-4">
          <MemoryTab companyId={id} />
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <Card className="p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Consultant Studio User Manual
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Learn how to effectively coordinate specialist agents, manage token consumption, tune contexts, and generate motivated reports.
              </p>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="agents">
                <AccordionTrigger className="text-base font-semibold">
                  🤖 Specialist Agent Roles & Coordination
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    The platform coordinates <strong>five specialist virtual agents</strong>. When you query the chatbot, the lead orchestrator automatically delegates tasks to these agents depending on your prompt:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 pl-2">
                    <li><strong>💰 CFO Agent:</strong> Analyzes company financials, cash flow, debt structures, runway, and financial opportunities.</li>
                    <li><strong>⚙️ COO Agent:</strong> Examines operations, delivery models, supply chain, team structures, and efficiency risks.</li>
                    <li><strong>📋 Tax Agent:</strong> Audits tax compliance, structures, tax incentives (e.g. R&D credits), and accounting risks.</li>
                    <li><strong>📣 Marketing Agent:</strong> Reviews brand positioning, channels, social engagement, organic acquisition, and copy strategies.</li>
                    <li><strong>🤝 BizDev Agent:</strong> Proposes sales partnerships, channel expansions, enterprise outreach strategies, and client acquisitions.</li>
                  </ul>
                  <p>
                    To get an in-depth specialist analysis directly, ask a targeted question. The orchestrator will trigger a tool call to consult them and combine their findings in the final chat reply.
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="tokens">
                <AccordionTrigger className="text-base font-semibold">
                  🪙 Token Usage, Tracking & Cost Limits
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    AI model executions consume <strong>tokens</strong> (sub-word components of text). Large context documents or multi-agent conversations consume more tokens.
                  </p>
                  <p>
                    <strong>Cost Controls & Limits:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Each company has a custom <strong>Token Limit</strong> (default is 100,000 tokens) to prevent runaway costs.</li>
                    <li>You can monitor current usage at any time by clicking the <strong>Coins (Token Settings)</strong> button next to the chat text field.</li>
                    <li>If the limit is reached, chatbot queries are temporarily disabled to prevent charges. You can increase the limit or reset the usage counter from the settings popover.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="tuning">
                <AccordionTrigger className="text-base font-semibold">
                  📄 Document Tuning & Context Uploads
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    You can upload primary source documents (such as financial statements, pitch decks, operational checklists, or PDF/TXT/MD files) directly to a company's tuning context:
                  </p>
                  <ul className="list-disc list-inside space-y-1 pl-2">
                    <li>Click <strong>"Add file"</strong> below the chat input, select your files, and they will be stored securely.</li>
                    <li>The orchestrator automatically reads these documents and passes them as key context into all future agent discussions.</li>
                    <li>The specialist agents will reconcile, quote, and cross-reference these documents during chats and reports.</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="reports">
                <AccordionTrigger className="text-base font-semibold">
                  📊 Structuring Premium Pre-Audit Reports
                </AccordionTrigger>
                <AccordionContent className="space-y-3 pt-2 text-sm text-muted-foreground leading-relaxed">
                  <p>
                    Reports generated by the orchestrator are designed to look professional, board-ready, and highly interactive. Every report follows a <strong>3-layer premium design philosophy</strong>:
                  </p>
                  <ul className="list-disc list-inside space-y-1.5 pl-2">
                    <li><strong>1. Visualizing (Interactive Charts):</strong> Contains interactive components (Recharts bars, pies, radars) to immediately display metric breakdowns.</li>
                    <li><strong>2. Writing (Structured Markdown):</strong> Clear headings, clean grid tables, bold calls-to-action, and specific specialist recommendations.</li>
                    <li><strong>3. Motivating (Momentum Wins):</strong> Ends with a dedicated <em>"Momentum"</em> roadmap highlighting quick next wins to inspire action.</li>
                  </ul>
                  <p>
                    You can generate reports by selecting a template in the <strong>"Reports"</strong> tab or by asking the chatbot to "generate a structured report for X". Once generated, click the <strong>"PDF"</strong> button to save or print it.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TokenLimitPopover({ company }: { company: any }) {
  const qc = useQueryClient();
  const updateLimit = useServerFn(updateCompanyTokenLimit);
  const resetUsage = useServerFn(resetCompanyTokenUsage);
  const [newLimit, setNewLimit] = useState(String(company.token_limit ?? 100000));
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    const limitVal = parseInt(newLimit, 10);
    if (isNaN(limitVal) || limitVal < 0) {
      toast.error("Please enter a valid limit");
      return;
    }
    setUpdating(true);
    try {
      await updateLimit({ data: { companyId: company.id, limit: limitVal } });
      toast.success("Token limit updated");
      qc.invalidateQueries({ queryKey: ["company", company.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    } finally {
      setUpdating(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Are you sure you want to reset token usage for this company?")) return;
    setUpdating(true);
    try {
      await resetUsage({ data: { companyId: company.id } });
      toast.success("Token usage reset");
      qc.invalidateQueries({ queryKey: ["company", company.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to reset");
    } finally {
      setUpdating(false);
    }
  };

  const used = company.token_used ?? 0;
  const limit = company.token_limit ?? 100000;
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <PopoverContent className="w-80 p-4 space-y-4" align="end">
      <div className="space-y-1">
        <h4 className="font-semibold text-sm leading-none flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-amber-500" /> Token Settings
        </h4>
        <p className="text-xs text-muted-foreground">
          Manage the token usage and limits for this company.
        </p>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Used this billing cycle</span>
          <span className={`font-semibold ${percent >= 90 ? "text-destructive" : percent >= 75 ? "text-amber-500" : "text-foreground"}`}>
            {used.toLocaleString()} / {limit.toLocaleString()} ({percent}%)
          </span>
        </div>
        <Progress value={percent} className="h-2" />
      </div>

      <div className="space-y-2 pt-1 border-t">
        <label className="text-xs font-medium block" htmlFor="token-limit-input">Custom Token Limit</label>
        <div className="flex gap-2">
          <Input
            id="token-limit-input"
            type="number"
            value={newLimit}
            onChange={(e) => setNewLimit(e.target.value)}
            placeholder="e.g. 100000"
            className="h-8 text-xs flex-1"
          />
          <Button size="sm" className="h-8 text-xs px-3" onClick={handleUpdate} disabled={updating}>
            Update
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-normal">
          Bypasses AI calls once reached. Set to 0 for unlimited.
        </p>
      </div>

      <div className="border-t pt-2.5 flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground">Dev Action</span>
        <Button size="sm" variant="destructive" className="h-7 px-2 text-xs" onClick={handleReset} disabled={updating}>
          Reset counter
        </Button>
      </div>
    </PopoverContent>
  );
}

function ChatPanel({ company, threads, documents }: { company: any; threads: any[]; documents: any[] }) {
  const companyId = company.id;
  const qc = useQueryClient();
  const create = useServerFn(createThread);
  const listMsgs = useServerFn(listThreadMessages);
  const send = useServerFn(sendChatMessage);
  const upload = useServerFn(uploadCompanyDocument);
  const [viewingDoc, setViewingDoc] = React.useState<any>(null);
  const [docChunks, setDocChunks] = React.useState<any[]>([]);
  const [loadingChunks, setLoadingChunks] = React.useState(false);

  React.useEffect(() => {
    if (!viewingDoc) return;
    setLoadingChunks(true);
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/document_chunks?document_id=eq.${viewingDoc.id}&select=chunk_index,content&order=chunk_index.asc`, {
      headers: {
        "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      }
    })
      .then(r => r.json())
      .then(data => { setDocChunks(Array.isArray(data) ? data : []); setLoadingChunks(false); })
      .catch(() => setLoadingChunks(false));
  }, [viewingDoc]);

  const removeDoc = useServerFn(deleteCompanyDocument);
  const [activeId, setActiveId] = useState<string | null>(threads[0]?.id ?? null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakEnabled, setSpeakEnabled] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const lastSpokenRef = useRef<string | null>(null);
  const autoSendRef = useRef(false);
  const voiceSupported =
    typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const onPickFile = () => fileRef.current?.click();

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 8 * 1024 * 1024) {
          toast.error(`${f.name} exceeds 8MB`);
          continue;
        }
        const mime = f.type || "application/octet-stream";
        const isText = mime.startsWith("text/") || /\.(md|txt|csv|json)$/i.test(f.name);
        if (isText) {
          const text = await f.text();
          await upload({ data: { companyId, name: f.name, mime: mime || "text/plain", text } });
        } else if (mime === "application/pdf" || /\.pdf$/i.test(f.name)) {
          const base64 = await fileToBase64(f);
          await upload({ data: { companyId, name: f.name, mime: "application/pdf", base64 } });
        } else {
          toast.error(`${f.name}: only PDF or text files are supported`);
          continue;
        }
        toast.success(`${f.name} added to tuning context`);
      }
      qc.invalidateQueries({ queryKey: ["company", companyId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onRemoveDoc = async (id: string) => {
    try {
      await removeDoc({ data: { id } });
      qc.invalidateQueries({ queryKey: ["company", companyId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  };

  useEffect(() => {
    if (!activeId && threads[0]?.id) setActiveId(threads[0].id);
  }, [threads, activeId]);

  const { data: msgsData } = useQuery({
    queryKey: ["msgs", activeId],
    queryFn: () => (activeId ? listMsgs({ data: { threadId: activeId } }) : Promise.resolve({ messages: [] })),
    enabled: !!activeId,
  });
  const messages = (msgsData as any)?.messages ?? [];

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [messages.length]);

  const newThread = async () => {
    const r = await create({ data: { companyId } });
    const t = (r as any).thread;
    qc.invalidateQueries({ queryKey: ["company", companyId] });
    setActiveId(t.id);
  };

  const stopSpeaking = () => {
    if (ttsSupported) window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const speak = (text: string) => {
    if (!ttsSupported || !text) return;
    try {
      window.speechSynthesis.cancel();
      // Strip markdown for cleaner speech
      const clean = text
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/[#*_`>]+/g, " ")
        .replace(/\[(.*?)\]\(.*?\)/g, "$1")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1200);
      if (!clean) return;
      const u = new SpeechSynthesisUtterance(clean);
      u.rate = 1.02;
      u.pitch = 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    } catch { }
  };

  const onSend = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || !activeId) return;
    setSending(true);
    setInput("");
    stopSpeaking();
    try {
      await send({ data: { threadId: activeId, message: text } });
      qc.invalidateQueries({ queryKey: ["msgs", activeId] });
      qc.invalidateQueries({ queryKey: ["company", companyId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Send failed");
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const toggleListening = () => {
    if (!voiceSupported) {
      toast.error("Voice input is not supported in this browser. Try Chrome or Edge.");
      return;
    }
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    autoSendRef.current = false;
    let finalText = "";
    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput((finalText + interim).trim());
      if (finalText) autoSendRef.current = true;
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e.error && e.error !== "no-speech" && e.error !== "aborted") {
        toast.error(`Mic: ${e.error}`);
      }
    };
    rec.onend = () => {
      setListening(false);
      const t = finalText.trim();
      if (autoSendRef.current && t) {
        autoSendRef.current = false;
        onSend(t);
      }
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  // Auto-speak the latest assistant reply when voice output is on
  useEffect(() => {
    if (!speakEnabled || !messages.length) return;
    const last = messages[messages.length - 1];
    if (last?.role !== "assistant") return;
    if (lastSpokenRef.current === last.id) return;
    lastSpokenRef.current = last.id;
    speak(last.content ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, speakEnabled]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch { }
      if (ttsSupported) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4 h-[600px]">
      <Card className="p-3 overflow-hidden flex flex-col">
        <Button size="sm" onClick={newThread} className="mb-2">
          <Plus className="h-3 w-3 mr-1" /> New chat
        </Button>
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {threads.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">No conversations yet.</p>
            )}
            {threads.map((t: any) => (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                className={`block w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent ${activeId === t.id ? "bg-accent" : ""}`}
              >
                {t.title}
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
            Start a new chat to ask the agents anything.
          </div>
        ) : (
          <>
            <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  Ask anything — the lead agent will delegate to CFO / COO / Tax as needed.
                </p>
              )}
              {messages.map((m: any) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                      }`}
                  >
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                    {m.metadata?.tools?.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer opacity-70">
                          {m.metadata.tools.length} agent action(s)
                        </summary>
                        <ul className="text-xs mt-1 opacity-80">
                          {m.metadata.tools.map((t: any, i: number) => (
                            <li key={i}>
                              · {t.tool}
                              {t.args?.agent ? ` → ${t.args.agent.toUpperCase()}` : ""}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm">
                    <Brain className="h-4 w-4 animate-pulse inline mr-2" />
                    Agents are working…
                  </div>
                </div>
              )}
            </div>
            <div className="border-t bg-muted/30">
              <div className="px-3 py-2 flex flex-wrap items-center gap-1.5 border-b border-border/50">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground mr-1 inline-flex items-center gap-1">
                  <Paperclip className="h-3 w-3" /> Tuning docs
                </span>
                {documents.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">none yet</span>
                )}
                {documents.map((d: any) => (
                  <Badge key={d.id} variant="secondary" className="gap-1 pr-1 max-w-[200px] cursor-pointer hover:bg-accent" onClick={() => setViewingDoc(d)}>
                    <FileText className="h-3 w-3 shrink-0" />
                    <span className="truncate text-xs">{d.name}</span>
                    <button
                      onClick={() => onRemoveDoc(d.id)}
                      className="ml-1 hover:text-destructive"
                      aria-label="remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={onPickFile}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Brain className="h-3 w-3 animate-pulse" />
                  ) : (
                    <Plus className="h-3 w-3 mr-1" />
                  )}
                  {uploading ? "Reading…" : "Add file"}
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,.txt,.md,.csv,.json,text/*,application/pdf"
                  multiple
                  className="hidden"
                  onChange={(e) => onFiles(e.target.files)}
                />
              </div>
              <div className="p-3 flex gap-2">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything — upload PDFs or notes above to tune the agents on this company"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      onSend();
                    }
                  }}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      title="Token usage settings"
                      className="relative shrink-0"
                    >
                      <Coins className="h-4 w-4 text-amber-500" />
                      {(company.token_used ?? 0) >= (company.token_limit ?? 100000) && (
                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <TokenLimitPopover company={company} />
                </Popover>
                <Button
                  type="button"
                  variant={listening ? "destructive" : "outline"}
                  size="icon"
                  onClick={toggleListening}
                  disabled={sending}
                  title={listening ? "Stop listening" : "Speak to the agent"}
                >
                  {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant={speakEnabled ? "default" : "outline"}
                  size="icon"
                  onClick={() => {
                    if (speakEnabled) stopSpeaking();
                    setSpeakEnabled((v) => !v);
                  }}
                  disabled={!ttsSupported}
                  title={speakEnabled ? "Mute voice replies" : "Hear voice replies"}
                >
                  {speakEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                <Button onClick={() => onSend()} disabled={sending || !input.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
      {viewingDoc && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingDoc(null)}>
          <div className="bg-background border rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h2 className="font-semibold text-sm">{viewingDoc.name}</h2>
                <p className="text-xs text-muted-foreground">{docChunks.length} chunks</p>
              </div>
              <button onClick={() => setViewingDoc(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="overflow-y-auto p-4 flex flex-col gap-3">
              {loadingChunks && <p className="text-sm text-muted-foreground">Loading chunks...</p>}
              {docChunks.map((c: any) => (
                <div key={c.chunk_index} className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">Chunk {c.chunk_index + 1}</p>
                  <p className="text-sm">{c.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MemoryTab({ companyId }: { companyId: string }) {
  const fetchMemory = useServerFn(getCompanyMemory);
  const { data, isLoading } = useQuery({
    queryKey: ["company-memory", companyId],
    queryFn: () => fetchMemory({ data: { companyId } }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-8">
        <Brain className="h-6 w-6 animate-pulse text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading intelligence data...</span>
      </div>
    );
  }

  return (
    <MemoryDashboard
      intelligence={data.intelligence}
      memories={data.memories}
      patterns={data.patterns}
      recentActivity={data.recentActivity}
    />
  );
}

function RiskOverview({ assessments }: { assessments: any[] }) {
  const data = assessments
    .filter((a) => a.risk_score != null)
    .map((a) => ({
      label: AGENT_META[a.agent]?.name ?? a.agent,
      value: a.risk_score as number,
    }));
  if (data.length === 0) return null;
  return (
    <Card className="p-5">
      <h3 className="font-semibold text-sm mb-3">Risk overview across agents</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

const FINDING_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  strengths: { label: "Strengths", icon: "✅", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  risks: { label: "Risks", icon: "⚠️", color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
  opportunities: { label: "Opportunities", icon: "💡", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  key_questions: { label: "Key Questions", icon: "❓", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
};

function AgentFindings({ findings }: { findings: any }) {
  let f = findings ?? {};
  if (typeof f === "string") try { f = JSON.parse(f); } catch { f = {}; }

  const sections = ["strengths", "risks", "opportunities", "key_questions"].filter(
    (k) => Array.isArray(f[k]) && f[k].length > 0
  );

  if (sections.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {sections.map((k) => {
        const meta = FINDING_META[k];
        return (
          <div key={k} className={`rounded-lg border p-3 ${meta.bg}`}>
            <div className={`text-xs font-semibold mb-2 ${meta.color}`}>
              {meta.icon} {meta.label} ({f[k].length})
            </div>
            <ul className="space-y-1.5">
              {f[k].map((item: string, i: number) => (
                <li key={i} className="text-xs text-muted-foreground leading-relaxed flex gap-2">
                  <span className="shrink-0 mt-0.5 h-1.5 w-1.5 rounded-full bg-current opacity-30" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

type ChartSpec = {
  title?: string;
  subtitle?: string;
  type?: "bar" | "pie" | "line" | "area" | "donut" | "radar" | "radial" | "funnel" | "horizontal_bar";
  data: Array<{ label: string; value: number; secondary?: number }>;
};

function ChartBlock({ spec }: { spec: ChartSpec }) {
  const data = Array.isArray(spec?.data) ? spec.data : [];
  if (data.length === 0) return null;
  const type = spec.type ?? "bar";
  const colored = data.map((d, i) => ({ ...d, fill: CHART_COLORS[i % CHART_COLORS.length] }));

  return (
    <div className="my-6 rounded-xl border bg-gradient-to-br from-card to-card/50 p-5 shadow-sm not-prose">
      {spec.title && (
        <div className="mb-3">
          <div className="text-sm font-semibold tracking-tight">{spec.title}</div>
          {spec.subtitle && <div className="text-xs text-muted-foreground mt-0.5">{spec.subtitle}</div>}
        </div>
      )}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {type === "pie" || type === "donut" ? (
            <PieChart>
              <Pie
                data={colored}
                dataKey="value"
                nameKey="label"
                outerRadius={100}
                innerRadius={type === "donut" ? 55 : 0}
                paddingAngle={2}
                label={(e: any) => `${e.label}`}
              >
                {colored.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : type === "line" ? (
            <LineChart data={colored}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={3} dot={{ r: 5 }} />
            </LineChart>
          ) : type === "area" ? (
            <AreaChart data={colored}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#areaFill)" />
            </AreaChart>
          ) : type === "radar" ? (
            <RadarChart data={colored}>
              <PolarGrid />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 11 }} />
              <PolarRadiusAxis tick={{ fontSize: 10 }} />
              <Radar dataKey="value" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.45} />
              <Tooltip />
            </RadarChart>
          ) : type === "radial" ? (
            <RadialBarChart innerRadius="20%" outerRadius="95%" data={colored} startAngle={90} endAngle={-270}>
              <RadialBar background dataKey="value" cornerRadius={8} />
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
            </RadialBarChart>
          ) : type === "funnel" ? (
            <FunnelChart>
              <Tooltip />
              <Funnel dataKey="value" data={colored} isAnimationActive>
                <LabelList position="right" fill="currentColor" stroke="none" dataKey="label" style={{ fontSize: 11 }} />
              </Funnel>
            </FunnelChart>
          ) : type === "horizontal_bar" ? (
            <BarChart data={colored} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={90} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                {colored.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          ) : (
            <BarChart data={colored}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {colored.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const ICON_MAP: Record<string, any> = {
  trending_up: TrendingUp, trending_down: TrendingDown, warning: AlertTriangle, check: CheckCircle2,
  target: Target, zap: Zap, dollar: DollarSign, rocket: Rocket, shield: Shield, lightbulb: Lightbulb,
  trophy: Trophy, flame: Flame, brain: Brain, sparkles: Sparkles,
};

type KPIItem = { label: string; value: string; delta?: string; trend?: "up" | "down" | "flat"; icon?: string; accent?: string };
function KPIBlock({ items }: { items: KPIItem[] }) {
  if (!items?.length) return null;
  return (
    <div className="not-prose my-6 grid gap-3 grid-cols-2 md:grid-cols-4">
      {items.map((k, i) => {
        const Icon = ICON_MAP[k.icon ?? ""] ?? Sparkles;
        const accent = k.accent ?? CHART_COLORS[i % CHART_COLORS.length];
        const trendColor = k.trend === "up" ? "text-emerald-600" : k.trend === "down" ? "text-rose-600" : "text-muted-foreground";
        return (
          <div key={i} className="rounded-xl border bg-card p-4 relative overflow-hidden shadow-sm">
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: accent }} />
            <div className="flex items-start justify-between">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{k.label}</div>
              <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}20`, color: accent }}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="text-2xl font-bold mt-2 tracking-tight">{k.value}</div>
            {k.delta && <div className={`text-xs mt-1 font-medium ${trendColor}`}>{k.delta}</div>}
          </div>
        );
      })}
    </div>
  );
}

type CalloutSpec = { variant?: "insight" | "warning" | "win" | "action"; title?: string; body: string; icon?: string };
function CalloutBlock({ spec }: { spec: CalloutSpec }) {
  const variants = {
    insight: { bg: "from-blue-500/10 to-blue-500/0", border: "border-l-blue-500", icon: Lightbulb, color: "text-blue-600" },
    warning: { bg: "from-amber-500/10 to-amber-500/0", border: "border-l-amber-500", icon: AlertTriangle, color: "text-amber-600" },
    win: { bg: "from-emerald-500/10 to-emerald-500/0", border: "border-l-emerald-500", icon: Trophy, color: "text-emerald-600" },
    action: { bg: "from-violet-500/10 to-violet-500/0", border: "border-l-violet-500", icon: Rocket, color: "text-violet-600" },
  };
  const v = variants[spec.variant ?? "insight"];
  const Icon = ICON_MAP[spec.icon ?? ""] ?? v.icon;
  return (
    <div className={`not-prose my-5 rounded-r-xl border-l-4 ${v.border} bg-gradient-to-r ${v.bg} p-4 flex gap-3`}>
      <div className={`shrink-0 ${v.color}`}><Icon className="h-5 w-5" /></div>
      <div>
        {spec.title && <div className="font-semibold text-sm mb-1">{spec.title}</div>}
        <div className="text-sm text-foreground/90 leading-relaxed">{spec.body}</div>
      </div>
    </div>
  );
}

type TimelineItem = { phase: string; weeks?: string; title: string; outcome?: string; owner?: string };
function TimelineBlock({ items }: { items: TimelineItem[] }) {
  if (!items?.length) return null;
  return (
    <div className="not-prose my-6 relative pl-6">
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-transparent" />
      {items.map((t, i) => (
        <div key={i} className="relative mb-5 last:mb-0">
          <div className="absolute -left-[18px] top-1 h-4 w-4 rounded-full border-2 border-background shadow"
            style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider font-bold text-primary">{t.phase}</span>
              {t.weeks && <span className="text-[10px] text-muted-foreground">· {t.weeks}</span>}
              {t.owner && <Badge variant="outline" className="ml-auto text-[10px]">{t.owner}</Badge>}
            </div>
            <div className="font-semibold text-sm mt-1">{t.title}</div>
            {t.outcome && <div className="text-xs text-muted-foreground mt-1">→ {t.outcome}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

type ScoreItem = { label: string; score: number; max?: number; verdict?: string };
function ScorecardBlock({ items }: { items: ScoreItem[] }) {
  if (!items?.length) return null;
  return (
    <div className="not-prose my-6 space-y-3">
      {items.map((s, i) => {
        const max = s.max ?? 100;
        const pct = Math.min(100, Math.max(0, (s.score / max) * 100));
        const color = pct >= 70 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444";
        return (
          <div key={i} className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-medium text-sm">{s.label}</span>
              <span className="font-bold tabular-nums" style={{ color }}>{s.score}<span className="text-xs text-muted-foreground">/{max}</span></span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}aa, ${color})` }} />
            </div>
            {s.verdict && <div className="text-xs text-muted-foreground mt-1.5">{s.verdict}</div>}
          </div>
        );
      })}
    </div>
  );
}

function RichReport({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-h1:text-2xl prose-h1:font-bold prose-h1:tracking-tight prose-h1:bg-gradient-to-r prose-h1:from-primary prose-h1:to-primary/60 prose-h1:bg-clip-text [&_h1]:text-transparent prose-h2:text-lg prose-h2:font-semibold prose-h2:mt-8 prose-h2:pb-2 prose-h2:border-b prose-h3:text-base prose-h3:font-semibold prose-h3:mt-6 prose-table:text-xs prose-th:bg-muted/60 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-hr:my-8 prose-strong:text-foreground prose-blockquote:border-primary prose-blockquote:bg-primary/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props: any) {
            const { inline, className, children } = props;
            const lang = /language-(\w+)/.exec(className || "")?.[1];
            if (!inline && lang) {
              const raw = String(children).trim();
              try {
                const parsed = JSON.parse(raw);
                if (lang === "chart") return <ChartBlock spec={parsed} />;
                if (lang === "kpi") return <KPIBlock items={parsed.items ?? parsed} />;
                if (lang === "callout") return <CalloutBlock spec={parsed} />;
                if (lang === "timeline") return <TimelineBlock items={parsed.items ?? parsed} />;
                if (lang === "scorecard") return <ScorecardBlock items={parsed.items ?? parsed} />;
              } catch {
                /* fall through */
              }
            }
            return <code className={className}>{children}</code>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

const REPORT_KINDS: { value: ReportKind; label: string; desc: string }[] = [
  { value: "pre_audit", label: "Pre-Audit Report", desc: "3-page external diagnosis with scorecard & roadmap" },
  { value: "sow", label: "Statement of Work", desc: "Engagement scope, deliverables, pricing tiers" },
  { value: "tax_recovery", label: "Tax Recovery Dossier", desc: "Credits, refunds, compliance map" },
  { value: "growth_plan", label: "90-Day Growth Plan", desc: "ICP, channels, outbound, KPIs" },
  { value: "operations_playbook", label: "Operations Playbook", desc: "SOPs, automation, key-person risk" },
  { value: "marketing_blueprint", label: "Marketing Blueprint", desc: "Brand, SEO, content, paid mix" },
];

function ReportGenerator({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const gen = useServerFn(generateStructuredReport);
  const listTpls = useServerFn(listReportTemplates);
  const delTpl = useServerFn(deleteReportTemplate);
  const [selectedValue, setSelectedValue] = useState<string>("builtin:pre_audit");
  const [busy, setBusy] = useState(false);

  const { data: tplData } = useQuery({
    queryKey: ["report-templates"],
    queryFn: () => listTpls(),
    staleTime: 30_000,
  });
  const customTemplates: any[] = (tplData as any)?.templates ?? [];

  const allOptions = [
    ...REPORT_KINDS.map((k) => ({
      value: `builtin:${k.value}`,
      label: k.label,
      desc: k.desc,
      kind: k.value as string,
      templateId: undefined as string | undefined,
      builtIn: true,
    })),
    ...customTemplates.map((t) => ({
      value: `custom:${t.id}`,
      label: t.label,
      desc: t.description || "Generated from chat — reusable across all companies",
      kind: "custom",
      templateId: t.id as string,
      builtIn: false,
    })),
  ];

  const selected = allOptions.find((o) => o.value === selectedValue) ?? allOptions[0];

  const onGenerate = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await gen({
        data: {
          companyId,
          kind: selected.kind,
          templateId: selected.templateId,
        },
      });
      toast.success(`${selected.label} generated`);
      qc.invalidateQueries({ queryKey: ["company", companyId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate");
    } finally {
      setBusy(false);
    }
  };

  const onDeleteTemplate = async () => {
    if (!selected?.templateId) return;
    try {
      await delTpl({ data: { id: selected.templateId } });
      toast.success("Template removed");
      setSelectedValue("builtin:pre_audit");
      qc.invalidateQueries({ queryKey: ["report-templates"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Delete failed");
    }
  };

  return (
    <Card className="p-5 bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">Generate a structured report</h3>
        {customTemplates.length > 0 && (
          <Badge variant="outline" className="ml-auto text-[10px]">
            +{customTemplates.length} from chat
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Built-in deliverables plus any report types your team has created through chat — available for every company.
      </p>
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={selectedValue} onValueChange={setSelectedValue}>
          <SelectTrigger className="sm:w-[320px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              Built-in
            </div>
            {allOptions
              .filter((o) => o.builtIn)
              .map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{o.label}</span>
                    <span className="text-xs text-muted-foreground">{o.desc}</span>
                  </div>
                </SelectItem>
              ))}
            {customTemplates.length > 0 && (
              <div className="px-2 py-1 mt-1 text-[10px] uppercase tracking-wide text-muted-foreground border-t">
                From chat
              </div>
            )}
            {allOptions
              .filter((o) => !o.builtIn)
              .map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  <div className="flex flex-col">
                    <span className="font-medium">{o.label}</span>
                    <span className="text-xs text-muted-foreground line-clamp-1">{o.desc}</span>
                  </div>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Button onClick={onGenerate} disabled={busy || !selected}>
          {busy ? <Brain className="h-4 w-4 mr-2 animate-pulse" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {busy ? "Composing…" : `Generate ${selected?.label ?? ""}`}
        </Button>
        {selected && !selected.builtIn && (
          <Button variant="ghost" size="icon" onClick={onDeleteTemplate} title="Remove template">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Card>
  );
}
