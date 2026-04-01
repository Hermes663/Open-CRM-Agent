"use client";

import { useMemo, useState } from "react";
import { Loader2, Play, RotateCcw } from "lucide-react";

import KanbanBoard from "@/components/pipeline/KanbanBoard";
import PipelineStats from "@/components/pipeline/PipelineStats";
import { triggerHeartbeat } from "@/lib/api";
import type { PipelineStats as PipelineStatsType } from "@/lib/types";
import { useRealtimeDeals } from "@/hooks/useRealtimeDeals";

function PipelineSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[68px] rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>
      <div className="flex gap-3 pt-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="w-[280px] min-w-[280px] rounded-xl bg-slate-100 p-3"
          >
            <div className="mb-3 h-1 w-full rounded-full bg-slate-200" />
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div
                  key={j}
                  className="h-[68px] rounded-lg border border-slate-200 bg-white"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { deals, loading, refetch, updateDealStage } = useRealtimeDeals();
  const [refreshing, setRefreshing] = useState(false);
  const [triggeringHeartbeat, setTriggeringHeartbeat] = useState(false);

  const stats: PipelineStatsType = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeDeals = deals.filter(
      (deal) => deal.stage !== "won" && deal.stage !== "lost",
    );
    const wonThisMonth = deals.filter(
      (deal) =>
        deal.stage === "won" && new Date(deal.updated_at) >= monthStart,
    );
    const closedThisMonth = deals.filter(
      (deal) =>
        (deal.stage === "won" || deal.stage === "lost") &&
        new Date(deal.updated_at) >= monthStart,
    );
    const winRate =
      closedThisMonth.length > 0
        ? Math.round((wonThisMonth.length / closedThisMonth.length) * 100)
        : 0;

    return {
      total_deals: activeDeals.length,
      total_value: activeDeals.reduce((sum, deal) => sum + deal.value, 0),
      won_this_month: wonThisMonth.length,
      win_rate: winRate,
    };
  }, [deals]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRunHeartbeat() {
    setTriggeringHeartbeat(true);
    try {
      await triggerHeartbeat();
      await refetch();
    } catch (error) {
      console.error("Failed to trigger heartbeat:", error);
    } finally {
      setTriggeringHeartbeat(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-slate-900">Pipeline</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn-secondary text-xs"
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={handleRunHeartbeat}
            disabled={triggeringHeartbeat}
            className="btn-primary text-xs"
          >
            {triggeringHeartbeat ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            {triggeringHeartbeat ? "Running..." : "Run Heartbeat"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 py-4">
        {loading ? (
          <PipelineSkeleton />
        ) : (
          <div className="flex h-full flex-col gap-4">
            <PipelineStats stats={stats} />
            <div className="flex-1 overflow-hidden">
              <KanbanBoard deals={deals} onStageChange={updateDealStage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
