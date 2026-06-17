import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Clock,
  Database,
  GitBranch,
  Zap,
} from "lucide-react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

const CATEGORY_ICONS: Record<string, any> = {
  fact: Database,
  decision: Zap,
  risk: AlertTriangle,
  relationship: GitBranch,
  preference: Lightbulb,
  context: Clock,
  prediction: TrendingUp,
  update: TrendingUp,
};

const CATEGORY_COLORS: Record<string, string> = {
  fact: "bg-blue-500",
  decision: "bg-green-500",
  risk: "bg-red-500",
  relationship: "bg-purple-500",
  preference: "bg-amber-500",
  context: "bg-slate-500",
  prediction: "bg-cyan-500",
  update: "bg-indigo-500",
};

type IntelligenceData = {
  score: number;
  breakdown: {
    memories: number;
    connections: number;
    patterns: number;
    avgConfidence: number;
    daysActive: number;
  };
  totalMemories: number;
  totalConnections: number;
};

type Memory = {
  id: string;
  content: string;
  category: string;
  confidence: number;
  agent: string;
  created_at: string;
};

type Pattern = {
  id: string;
  pattern_text: string;
  pattern_type: string;
  confidence: number;
  times_observed: number;
};

export function MemoryDashboard({
  intelligence,
  memories,
  patterns,
  recentActivity,
}: {
  intelligence: IntelligenceData;
  memories: Memory[];
  patterns: Pattern[];
  recentActivity: Memory[];
}) {
  const { score, breakdown } = intelligence;

  return (
    <div className="space-y-6">
      {/* Intelligence Score Header */}
      <Card className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Intelligence Score
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              How much the AI knows about this company
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-primary">{score}</div>
            <div className="text-xs text-muted-foreground">/ 1000</div>
          </div>
        </div>

        <div className="mt-4">
          <Progress value={Math.min(100, (score / 1000) * 100)} className="h-3" />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="text-center">
            <div className="text-2xl font-bold">{breakdown.memories}</div>
            <div className="text-xs text-muted-foreground">Memories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{breakdown.connections}</div>
            <div className="text-xs text-muted-foreground">Connections</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{breakdown.patterns}</div>
            <div className="text-xs text-muted-foreground">Patterns</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{Math.round(breakdown.avgConfidence * 100)}%</div>
            <div className="text-xs text-muted-foreground">Confidence</div>
          </div>
        </div>

        <div className="mt-4 text-center">
          <Badge variant="outline" className="text-sm">
            {breakdown.daysActive} days active • Geometric growth:{" "}
            {Math.pow(2, Math.floor(breakdown.daysActive / 7)).toFixed(0)}x intelligence
          </Badge>
        </div>
      </Card>

      {/* Recent Activity Timeline */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          Recent Learning
        </h3>

        {recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No memories yet. Start chatting to build intelligence.
          </p>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((mem) => {
              const Icon = CATEGORY_ICONS[mem.category] || Database;
              const color = CATEGORY_COLORS[mem.category] || "bg-slate-500";
              return (
                <div key={mem.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <div
                    className={`h-8 w-8 rounded-full ${color} flex items-center justify-center shrink-0`}
                  >
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{mem.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {mem.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(mem.confidence * 100)}% confidence
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(mem.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Learned Patterns */}
      {patterns.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Detected Patterns
          </h3>
          <div className="space-y-3">
            {patterns.map((pattern) => (
              <div key={pattern.id} className="p-3 rounded-lg border bg-card">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge
                      variant={pattern.pattern_type === "risk" ? "destructive" : "default"}
                      className="text-[10px]"
                    >
                      {pattern.pattern_type}
                    </Badge>
                    <p className="text-sm mt-2">{pattern.pattern_text}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold">{Math.round(pattern.confidence * 100)}%</div>
                    <div className="text-[10px] text-muted-foreground">confidence</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Observed {pattern.times_observed} times
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Memory Distribution by Category */}
      {memories.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Memory Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(
              memories.reduce(
                (acc, m) => {
                  acc[m.category] = (acc[m.category] || 0) + 1;
                  return acc;
                },
                {} as Record<string, number>,
              ),
            ).map(([category, count]) => {
              const Icon = CATEGORY_ICONS[category] || Database;
              const color = CATEGORY_COLORS[category] || "bg-slate-500";
              return (
                <div key={category} className="p-3 rounded-lg border text-center">
                  <div
                    className={`h-10 w-10 rounded-full ${color} mx-auto flex items-center justify-center mb-2`}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="text-lg font-bold">{count as number}</div>
                  <div className="text-xs text-muted-foreground capitalize">{category}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
