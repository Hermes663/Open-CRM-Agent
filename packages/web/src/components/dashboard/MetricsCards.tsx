'use client';

import { Target, DollarSign, Mail, Bot, TrendingUp, TrendingDown } from 'lucide-react';
import type { DashboardMetrics } from '@/lib/types';

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend: number;
  borderColor: string;
}

function MetricCard({ icon, label, value, trend, borderColor }: MetricCardProps) {
  const isPositive = trend >= 0;

  return (
    <div className={`card flex items-start gap-4 border-l-4 ${borderColor}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
        <div className="mt-1 flex items-center gap-1">
          {isPositive ? (
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
          )}
          <span
            className={`text-xs font-medium ${
              isPositive ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {isPositive ? '+' : ''}
            {trend}%
          </span>
          <span className="text-xs text-slate-400">vs last period</span>
        </div>
      </div>
    </div>
  );
}

interface MetricsCardsProps {
  metrics: DashboardMetrics;
}

export default function MetricsCards({ metrics }: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        icon={<Target className="h-5 w-5" />}
        label="Active Deals"
        value={metrics.active_deals.toString()}
        trend={metrics.active_deals_trend}
        borderColor="border-l-blue-500"
      />
      <MetricCard
        icon={<DollarSign className="h-5 w-5" />}
        label="Pipeline Value"
        value={`€${formatCompact(metrics.pipeline_value)}`}
        trend={metrics.pipeline_value_trend}
        borderColor="border-l-emerald-500"
      />
      <MetricCard
        icon={<Mail className="h-5 w-5" />}
        label="Emails Sent (7d)"
        value={metrics.emails_sent_7d.toString()}
        trend={metrics.emails_sent_trend}
        borderColor="border-l-violet-500"
      />
      <MetricCard
        icon={<Bot className="h-5 w-5" />}
        label="Agent Actions (24h)"
        value={metrics.agent_actions_24h.toString()}
        trend={metrics.agent_actions_trend}
        borderColor="border-l-amber-500"
      />
    </div>
  );
}
