"use client";

import { useMemo } from "react";
import { Play, Plus } from "lucide-react";
import { useRealtimeDeals } from "@/hooks/useRealtimeDeals";
import KanbanBoard from "@/components/pipeline/KanbanBoard";
import PipelineStats from "@/components/pipeline/PipelineStats";
import type { PipelineStats as PipelineStatsType } from "@/lib/types";

function PipelineSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[68px] rounded-xl border border-slate-200 bg-white"
          />
        ))}
      </div>
      {/* Board skeleton */}
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
                  className="h-[68px] rounded-lg bg-white border border-slate-200"
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
  const { deals, loading } = useRealtimeDeals();

  const stats: PipelineStatsType = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeDeals = deals.filter(
      (d) => d.stage !== "won" && d.stage !== "lost"
    );
    const wonThisMonth = deals.filter(
      (d) => d.stage === "won" && new Date(d.updated_at) >= monthStart
    );
    const closedThisMonth = deals.filter(
      (d) =>
        (d.stage === "won" || d.stage === "lost") &&
        new Date(d.updated_at) >= monthStart
    );
    const winRate =
      closedThisMonth.length > 0
        ? Math.round((wonThisMonth.length / closedThisMonth.length) * 100)
        : 0;

    return {
      total_deals: activeDeals.length,
      total_value: activeDeals.reduce((sum, d) => sum + d.value, 0),
      won_this_month: wonThisMonth.length,
      win_rate: winRate,
    };
  }, [deals]);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <h1 className="text-lg font-bold text-slate-900">Pipeline</h1>
        <div className="flex items-center gap-2">
          <button className="btn-secondary text-xs">
            <Plus className="h-3.5 w-3.5" />
            Add Deal
          </button>
          <button className="btn-primary text-xs">
            <Play className="h-3.5 w-3.5" />
            Run Agent
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden px-6 py-4">
        {loading ? (
          <PipelineSkeleton />
        ) : (
          <div className="flex h-full flex-col gap-4">
            <PipelineStats stats={stats} />
            <div className="flex-1 overflow-hidden">
              <KanbanBoard deals={deals} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
