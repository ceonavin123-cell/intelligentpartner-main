import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Brain,
  FileText,
  Mic,
  Volume2,
  Sparkles,
  Download,
  Paperclip,
  MessageSquare,
  Search,
  HelpCircle,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/manual")({
  component: ManualPage,
});

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground space-y-2 leading-relaxed">{children}</div>
    </Card>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="h-6 w-6 shrink-0 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
        {n}
      </div>
      <div className="text-sm text-foreground/90">{children}</div>
    </div>
  );
}

function ManualPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">User Manual</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Everything you need to run Intelligent Partner end-to-end.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Download className="h-4 w-4 mr-2" /> Print / PDF
          </Button>
          <Button asChild>
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Link>
          </Button>
        </div>
      </div>

      <Card className="p-5 bg-gradient-to-br from-primary/10 to-transparent border-primary/30">
        <h2 className="text-lg font-semibold mb-1">Welcome 👋</h2>
        <p className="text-sm text-muted-foreground">
          Intelligent Partner is a consulting workspace powered by five specialist AI agents —
          CFO, COO, Tax, Marketing and BizDev. Add a company, tune the agents with documents,
          chat (by voice or text), and generate board-ready reports.
        </p>
      </Card>

      <Section icon={Building2} title="1. Add a client company">
        <Step n={1}>
          Go to <strong>Dashboard → Add company</strong>. Enter the company name and (optionally)
          the website and industry.
        </Step>
        <Step n={2}>
          Background research starts automatically. The five agents read public sources and build
          an initial profile, risk overview, and findings.
        </Step>
        <Step n={3}>
          Click <strong>Open</strong> on any company card to enter its workspace.
        </Step>
      </Section>

      <Section icon={Briefcase} title="2. Web scraping prospect jobs">
        <Step n={1}>
          Open the <strong>Web Scraping</strong> tab on the dashboard.
        </Step>
        <Step n={2}>
          Click <strong>Refresh jobs</strong>. The system pulls the top ~30 listings from
          Merojob &amp; JobsNepal across accounting, finance, operations, management consulting and
          business automation.
        </Step>
        <Step n={3}>
          Each card shows title, company, email, website, contact, address and salary. Hit{" "}
          <strong>Open workspace</strong> to convert a prospect into a client and start the
          standard research workflow.
        </Step>
      </Section>

      <Section icon={Paperclip} title="3. Tune the agents with documents">
        <Step n={1}>
          Inside a company workspace, open the <strong>Chat</strong> panel.
        </Step>
        <Step n={2}>
          Use the <strong>Tuning docs → Add file</strong> button to upload PDFs, text, CSV, JSON
          or markdown (≤ 8MB each). PDFs are auto-extracted into clean text.
        </Step>
        <Step n={3}>
          Uploaded documents become primary context for both the chatbot and the report generator.
          Remove a doc with the ✕ on its badge.
        </Step>
      </Section>

      <Section icon={MessageSquare} title="4. Chat with the lead agent">
        <Step n={1}>
          Start a new conversation with <strong>New chat</strong>. Past threads stay in the
          sidebar.
        </Step>
        <Step n={2}>
          Ask anything — the lead orchestrator routes the question to the right specialists (CFO,
          COO, Tax, Marketing, BizDev) and synthesizes the reply with citations.
        </Step>
        <Step n={3}>
          Expand <em>agent action(s)</em> under any reply to see which tools and specialists were
          consulted.
        </Step>
      </Section>

      <Section icon={Mic} title="5. Voice agent (listen, write, speak)">
        <Step n={1}>
          Click the <Mic className="inline h-3 w-3" /> mic in the composer and speak. Your voice is
          transcribed live and auto-sent when you pause.
        </Step>
        <Step n={2}>
          Toggle the <Volume2 className="inline h-3 w-3" /> speaker to have replies read aloud
          automatically.
        </Step>
        <Step n={3}>
          Works best in Chrome or Edge. Grant microphone permission when the browser asks.
        </Step>
      </Section>

      <Section icon={FileText} title="6. Generate reports">
        <Step n={1}>
          In the <strong>Reports</strong> tab, pick a template from{" "}
          <strong>Generate structured report</strong>. The <em>From chat</em> section lists custom
          templates you created via the chatbot — they're reusable for every company.
        </Step>
        <Step n={2}>
          Reports include charts, KPI cards, tables and a <em>🚀 Momentum</em> closing — a mix of
          pictorial, infographic and executive narrative.
        </Step>
        <Step n={3}>
          Click <Download className="inline h-3 w-3" /> <strong>PDF</strong> on any report to
          download a professional, paginated PDF with page numbers in the footer.
        </Step>
      </Section>

      <Section icon={Sparkles} title="7. Create reports from chat">
        <p>
          Ask the chatbot for any deliverable — "build me a cash-flow stress test", "write a SOW
          for digital transformation", "investor memo". It saves the report and registers the
          template, so the same report type appears in every company's dropdown.
        </p>
      </Section>

      <Section icon={Brain} title="8. Memory &amp; learning">
        <p>
          When you share durable facts ("we hired a new CFO last month"), the orchestrator stores
          them in long-term memory. Future conversations and reports honor that context
          automatically.
        </p>
      </Section>

      <Section icon={Search} title="Tips &amp; troubleshooting">
        <ul className="list-disc pl-5 space-y-1">
          <li>Re-run research on a company anytime with <strong>Refresh</strong> on its page.</li>
          <li>Hit a rate limit? Wait a moment — the AI gateway throttles bursts.</li>
          <li>Out of AI credits? An admin can top up the workspace billing.</li>
          <li>Voice not working? Check site permissions and use Chrome/Edge.</li>
          <li>To stop voice playback mid-sentence, toggle the speaker icon off.</li>
        </ul>
      </Section>

      <Section icon={HelpCircle} title="Troubleshooting FAQ">
        <div className="space-y-4">
          <div>
            <p className="font-semibold text-foreground">Document tuning failed or the file won't attach</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Check the file is under <strong>8 MB</strong> and is a PDF, TXT, MD, JSON, or CSV. Scans of images-only PDFs may extract very little text — re-export as a text PDF if possible.</li>
              <li>Password-protected or encrypted PDFs are rejected. Remove the password and re-upload.</li>
              <li>If extraction returns empty, the AI gateway may have hit a rate limit — wait 30 seconds and retry.</li>
              <li>After uploading, confirm the document badge appears above the composer. If it doesn't, the upload was rejected — check the toast for the exact reason.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-foreground">A report template created in chat is missing from the dropdown</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Templates only save after the chat successfully <em>generates</em> a report — asking the agent to "design" one isn't enough. Tell it: <em>"generate this report now"</em>.</li>
              <li>Reload the company page — the <strong>From chat</strong> section refreshes when the page mounts.</li>
              <li>Templates are workspace-wide. If a teammate created it, make sure you're signed in to the same workspace.</li>
              <li>If duplicates appear, the slug collided — rename the new report in chat before generating.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-foreground">Voice transcription not working</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Voice uses the browser's built-in Web Speech API. Use <strong>Chrome, Edge, or Safari</strong> — Firefox is not supported.</li>
              <li>Grant microphone permission when prompted. On macOS also check <em>System Settings → Privacy → Microphone</em>.</li>
              <li>The page must be on <strong>HTTPS</strong> (the published and preview URLs both are). Local <code>http://</code> won't work.</li>
              <li>If the mic button turns red but nothing transcribes, another app may be holding the microphone — close Zoom/Meet/Teams and retry.</li>
              <li>Speak one sentence at a time. The recognizer auto-sends after a short pause; long monologues get cut off.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-foreground">Voice replies stay silent</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Confirm the speaker icon is <strong>on</strong> (not muted) next to the send button.</li>
              <li>Check system volume and that the browser tab isn't muted (right-click the tab → <em>Unmute site</em>).</li>
              <li>Replies longer than ~1200 characters are trimmed for speech — the full text is still in the chat.</li>
            </ul>
          </div>

          <div>
            <p className="font-semibold text-foreground">Report PDF looks broken or pages cut off</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Use the <strong>Download PDF</strong> button rather than the browser's print menu — it sets the correct page size and margins.</li>
              <li>In the print dialog, set <em>Margins: Default</em> and <em>Background graphics: On</em>.</li>
              <li>If charts appear blank, wait for the report to finish rendering before clicking download.</li>
            </ul>
          </div>
        </div>
      </Section>

      <p className="text-xs text-center text-muted-foreground pt-4">
        Need more help? Ask the lead agent — it knows the product too.
      </p>
    </div>
  );
}
