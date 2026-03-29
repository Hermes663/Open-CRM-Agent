'use client';

import { useEffect, useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import MetricsCards from '@/components/dashboard/MetricsCards';
import AgentActivityFeed from '@/components/dashboard/AgentActivityFeed';
import { PIPELINE_STAGES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { DashboardMetrics, PipelineSummary } from '@/lib/types';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [pipelineSummary, setPipelineSummary] = useState<PipelineSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringAgent, setTriggeringAgent] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const pipelineRes = await fetch('/api/pipeline');
        const pipelineData: PipelineSummary[] = pipelineRes.ok
          ? await pipelineRes.json()
          : [];
        setPipelineSummary(pipelineData);

        const activeDeals = pipelineData
          .filter((s) => !['won', 'lost'].includes(s.stage))
          .reduce((acc, s) => acc + s.count, 0);
        const pipelineValue = pipelineData
          .filter((s) => !['won', 'lost'].includes(s.stage))
          .reduce((acc, s) => acc + s.total_value, 0);

        let emailsSent = 0;
        let agentActions = 0;

        try {
          const agentRes = await fetch('/api/agent/runs');
          if (agentRes.ok) {
            const runs = await agentRes.json();
            const now = Date.now();
            agentActions = runs
              .filter(
                (r: { created_at: string }) =>
                  now - new Date(r.created_at).getTime() < 86400000
              )
              .reduce(
                (acc: number, r: { actions_taken: number }) =>
                  acc + (r.actions_taken ?? 0),
                0
              );
          }
        } catch {
          // endpoint may not exist yet
        }

        setMetrics({
          active_deals: activeDeals,
          active_deals_trend: 12,
          pipeline_value: pipelineValue,
          pipeline_value_trend: 8,
          emails_sent_7d: emailsSent,
          emails_sent_trend: 5,
          agent_actions_24h: agentActions,
          agent_actions_trend: 15,
        });
      } catch (err) {
        console.error('Failed to load dashboard:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  async function handleRunAgent() {
    setTriggeringAgent(true);
    try {
      await fetch('/api/agent/trigger', { method: 'POST' });
    } catch (err) {
      console.error('Failed to trigger agent:', err);
    } finally {
      setTimeout(() => setTriggeringAgent(false), 2000);
    }
  }

  if (loading || !metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      </div>
    );
  }

  const maxStageCount = Math.max(...pipelineSummary.map((s) => s.count), 1);

  return (
    <div className="flex flex-col">
      <TopBar title="Dashboard" subtitle="Overview of your sales pipeline">
        <button
          onClick={handleRunAgent}
          disabled={triggeringAgent}
          className={cn('btn-primary h-9 gap-1.5 text-xs', triggeringAgent && 'opacity-75')}
        >
          {triggeringAgent ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {triggeringAgent ? 'Running...' : 'Run Agent Now'}
        </button>
      </TopBar>

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
                const summary = pipelineSummary.find((s) => s.stage === stage.id);
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
