"use client";

import { Loader2 } from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { useAgentRuns } from "@/hooks/useAgentRuns";
import { AGENT_COLORS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/utils";

export default function AgentRunsPage() {
  const { runs, loading } = useAgentRuns(100);

  return (
    <div className="flex flex-col">
      <TopBar
        title="Agent Runs"
        subtitle="Recent executions recorded by the FastAPI runtime"
      />

      <div className="p-6">
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Agent
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Started
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    </td>
                  </tr>
                ) : runs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                      No agent runs recorded yet
                    </td>
                  </tr>
                ) : (
                  runs.map((run) => (
                    <tr
                      key={run.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        {run.agent_name ? (
                          <span
                            className={`badge ${
                              AGENT_COLORS[run.agent_name] ??
                              "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {run.agent_name}
                          </span>
                        ) : (
                          <span className="text-slate-500">system</span>
                        )}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-700">
                        {run.status}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{run.run_type}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatRelativeTime(run.started_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {run.duration_ms ? `${run.duration_ms} ms` : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {run.output_summary ?? run.input_summary ?? "-"}
                        {run.error_message ? (
                          <p className="mt-1 text-xs text-red-600">
                            {run.error_message}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
