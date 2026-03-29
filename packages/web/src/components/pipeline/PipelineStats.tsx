"use client";

import { TrendingUp, DollarSign, Trophy, Percent } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { PipelineStats as Stats } from "@/lib/types";

interface PipelineStatsProps {
  stats: Stats;
}

const metrics = [
  {
    key: "total_deals" as const,
    label: "Total Deals",
    icon: TrendingUp,
    format: (v: number) => v.toString(),
    color: "text-blue-600 bg-blue-50",
  },
  {
    key: "total_value" as const,
    label: "Pipeline Value",
    icon: DollarSign,
    format: (v: number) => formatCurrency(v, "EUR"),
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    key: "won_this_month" as const,
    label: "Won This Month",
    icon: Trophy,
    format: (v: number) => v.toString(),
    color: "text-amber-600 bg-amber-50",
  },
  {
    key: "win_rate" as const,
    label: "Win Rate",
    icon: Percent,
    format: (v: number) => `${v}%`,
    color: "text-violet-600 bg-violet-50",
  },
];

export default function PipelineStats({ stats }: PipelineStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.key}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${m.color}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{m.label}</p>
              <p className="text-base font-bold text-slate-900 truncate">
                {m.format(stats[m.key])}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
