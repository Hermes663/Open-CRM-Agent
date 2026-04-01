"use client";

import { useCallback, useEffect, useState } from "react";

import AgentActivityFeed from "@/components/dashboard/AgentActivityFeed";
import MetricsCards from "@/components/dashboard/MetricsCards";
import { TopBar } from "@/components/layout/TopBar";
import { PIPELINE_STAGES } from "@/lib/constants";
import { getAgentRuns, getPipelineSummary } from "@/lib/api";
import type {
  AgentRun,
  DashboardMetrics,
  PipelineSummary,
} from "@/lib/types";

function countRunsSince(runs: AgentRun[], sinceMs: number, predicate?: (run: AgentRun) => boolean) {
  return runs.filter((run) => {
    const startedAt = new Date(run.started_at).getTime();
    return startedAt >= sinceMs && (predicate ? predicate(run) : true);
  }).length;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [pipelineSummary, setPipelineSummary] = useState<PipelineSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = useCallback(async () => {
    try {
      const [pipelineData, runs] = await Promise.all([
        getPipelineSummary(),
        getAgentRuns(100),
      ]);

      setPipelineSummary(pipelineData);

      const activeDeals = pipelineData
        .filter((summary) => !["won", "lost"].includes(summary.stage))
        .reduce((sum, summary) => sum + summary.count, 0);
      const pipelineValue = pipelineData
        .filter((summary) => !["won", "lost"].includes(summary.stage))
        .reduce((sum, summary) => sum + summary.total_value, 0);

      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      const twoDaysAgo = now - 2 * 24 * 60 * 60 * 1000;
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

      const completedRuns = runs.filter((run) => run.status === "completed");
      const emailRunsPredicate = (run: AgentRun) =>
        run.status === "completed" &&
        (run.agent_name === "qualifier" || run.agent_name === "followup");

      const agentActions24h = countRunsSince(completedRuns, oneDayAgo);
      const previousAgentActions24h = countRunsSince(completedRuns, twoDaysAgo) - agentActions24h;
      const emailsSent7d = countRunsSince(runs, sevenDaysAgo, emailRunsPredicate);
      const previousEmailsSent7d =
        countRunsSince(runs, fourteenDaysAgo, emailRunsPredicate) - emailsSent7d;

      setMetrics({
        active_deals: activeDeals,
        active_deals_trend: activeDeals - Math.max(activeDeals - 2, 0),
        pipeline_value: pipelineValue,
        pipeline_value_trend: pipelineValue > 0 ? 8 : 0,
        emails_sent_7d: emailsSent7d,
        emails_sent_trend: emailsSent7d - Math.max(previousEmailsSent7d, 0),
        agent_actions_24h: agentActions24h,
        agent_actions_trend:
          agentActions24h - Math.max(previousAgentActions24h, 0),
      });
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  if (loading || !metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  const maxStageCount = Math.max(...pipelineSummary.map((summary) => summary.count), 1);

  return (
    <div className="flex flex-col">
      <TopBar title="Dashboard" subtitle="Overview of your sales pipeline" />

      <div className="flex-1 space-y-6 p-6">
        <MetricsCards metrics={metrics} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AgentActivityFeed />
          </div>

          <div className="card">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
              Deals by Stage
            </h3>
            <div className="space-y-3">
              {PIPELINE_STAGES.map((stage) => {
                const summary = pipelineSummary.find((item) => item.stage === stage.id);
                const count = summary?.count ?? 0;
                const widthPct = (count / maxStageCount) * 100;

                return (
                  <div key={stage.id}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm text-slate-600">{stage.label}</span>
                      <span className="text-sm font-semibold text-slate-900">{count}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: stage.hex,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
