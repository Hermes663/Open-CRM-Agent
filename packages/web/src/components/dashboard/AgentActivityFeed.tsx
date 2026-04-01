"use client";

import type { ElementType } from "react";
import { Activity, Bot, CircleX, Clock3, Loader2 } from "lucide-react";

import { useAgentRuns } from "@/hooks/useAgentRuns";
import { AGENT_COLORS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/utils";

const RUN_STATUS_CONFIG: Record<
  string,
  { icon: ElementType; color: string; bg: string; label: string }
> = {
  completed: {
    icon: Bot,
    color: "text-emerald-600",
    bg: "bg-emerald-100",
    label: "Completed",
  },
  running: {
    icon: Clock3,
    color: "text-blue-600",
    bg: "bg-blue-100",
    label: "Running",
  },
  failed: {
    icon: CircleX,
    color: "text-red-600",
    bg: "bg-red-100",
    label: "Failed",
  },
  skipped: {
    icon: Activity,
    color: "text-slate-600",
    bg: "bg-slate-100",
    label: "Skipped",
  },
};

export default function AgentActivityFeed() {
  const { runs, loading } = useAgentRuns(30);

  if (loading) {
    return (
      <div className="card">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Agent Activity
        </h3>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Agent Activity
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          Polling
        </span>
      </div>

      <div className="max-h-[480px] space-y-1 overflow-y-auto pr-1">
        {runs.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No recent agent runs
          </p>
        ) : (
          runs.map((run) => {
            const config = RUN_STATUS_CONFIG[run.status] ?? RUN_STATUS_CONFIG.skipped;
            const Icon = config.icon;

            return (
              <div
                key={run.id}
                className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bg}`}
                >
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug text-slate-700">
                    {run.output_summary ??
                      run.input_summary ??
                      `${run.agent_name ?? "agent"} ${config.label.toLowerCase()}`}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {formatRelativeTime(run.started_at)}
                    </span>
                    {run.agent_name && (
                      <span
                        className={`badge text-[10px] ${
                          AGENT_COLORS[run.agent_name] ??
                          "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {run.agent_name}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{config.label}</span>
                  </div>
                  {run.error_message && (
                    <p className="mt-1 text-xs text-red-600">{run.error_message}</p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
