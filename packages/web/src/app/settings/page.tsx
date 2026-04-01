"use client";

import { useEffect, useState } from "react";
import type { ElementType } from "react";
import {
  BookOpen,
  Database,
  Info,
  Layers,
  Mail,
  Settings2,
} from "lucide-react";

import { TopBar } from "@/components/layout/TopBar";
import { getSettingsStatus } from "@/lib/api";
import { PIPELINE_STAGES } from "@/lib/constants";
import type { SettingsStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "agent" | "email" | "pipeline" | "about";

const TABS: { id: Tab; label: string; icon: ElementType }[] = [
  { id: "agent", label: "Agent Configuration", icon: Settings2 },
  { id: "email", label: "Email Provider", icon: Mail },
  { id: "pipeline", label: "Pipeline Stages", icon: Layers },
  { id: "about", label: "About", icon: Info },
];

function StatusBadge({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        enabled
          ? "bg-emerald-100 text-emerald-700"
          : "bg-amber-100 text-amber-700",
      )}
    >
      {label}
    </span>
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("agent");
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStatus() {
      try {
        const data = await getSettingsStatus();
        setStatus(data);
      } catch (error) {
        console.error("Failed to load settings status:", error);
      } finally {
        setLoading(false);
      }
    }

    void loadStatus();
  }, []);

  return (
    <div className="flex flex-col">
      <TopBar title="Settings" subtitle="Runtime status for the production MVP" />

      <div className="flex-1 p-6">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex gap-1 rounded-lg bg-slate-100 p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    activeTab === tab.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="card">
            {loading || !status ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              </div>
            ) : null}

            {!loading && status && activeTab === "agent" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Agent Configuration
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    This screen reflects the current backend runtime state. In v1 it
                    is intentionally read-only, so the UI does not pretend to save
                    configuration that is actually sourced from environment variables.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">LLM Provider</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-900">
                        {status.llm_provider ?? "Not configured"}
                      </span>
                      <StatusBadge
                        label={status.llm_configured ? "Configured" : "Missing credentials"}
                        enabled={status.llm_configured}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">
                      Heartbeat Interval
                    </p>
                    <p className="mt-2 text-sm text-slate-900">
                      {status.heartbeat_interval_minutes} minutes
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">Database</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="text-sm text-slate-900">PostgreSQL runtime</span>
                      <StatusBadge
                        label={status.database_configured ? "Configured" : "Missing DATABASE_URL"}
                        enabled={status.database_configured}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">
                      Active automation scope
                    </p>
                    <p className="mt-2 text-sm text-slate-900">
                      Research, qualifier and follow-up agents are enabled in v1.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {!loading && status && activeTab === "email" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Email Provider
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Email sending is handled by the backend channel factory. This view
                    shows whether a real provider is configured.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">Provider</p>
                    <p className="mt-2 text-sm text-slate-900">
                      {status.email_provider ?? "Not configured"}
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-700">Credentials</p>
                    <div className="mt-2">
                      <StatusBadge
                        label={status.email_configured ? "Configured" : "Missing credentials"}
                        enabled={status.email_configured}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  Runtime configuration remains environment-driven in v1. The UI no
                  longer shows a fake save flow.
                </div>
              </div>
            ) : null}

            {!loading && status && activeTab === "pipeline" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Pipeline Stages
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    These are the canonical stages supported by the current runtime.
                  </p>
                </div>

                <div className="space-y-2">
                  {PIPELINE_STAGES.map((stage, index) => (
                    <div
                      key={stage.id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <span className="w-6 font-mono text-sm text-slate-400">
                        {index + 1}
                      </span>
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: stage.hex }}
                      />
                      <span className="flex-1 text-sm font-medium text-slate-700">
                        {stage.label}
                      </span>
                      <span className="text-xs text-slate-400">{stage.id}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  `negotiation` and `closing` remain visible in the CRM, but automated
                  routing to non-existent specialist agents is disabled in v1.
                </div>
              </div>
            ) : null}

            {!loading && status && activeTab === "about" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    About AutoSales AI
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Production MVP status for the CRM, dashboard, heartbeat, and
                    agent runtime.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-slate-500" />
                      <p className="text-sm font-medium text-slate-700">Runtime</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-900">
                      Next.js UI + FastAPI agents + PostgreSQL
                    </p>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-slate-500" />
                      <p className="text-sm font-medium text-slate-700">Status</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-900">
                      Runtime-aligned configuration and internal API contracts enabled.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
