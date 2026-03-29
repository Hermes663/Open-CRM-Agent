import type { StageConfig } from "@/lib/types";

export const PIPELINE_STAGES: StageConfig[] = [
  { id: "new_deal",     label: "New Deal",     color: "slate-500",   hex: "#64748b" },
  { id: "first_email",  label: "First Email",  color: "blue-500",    hex: "#3b82f6" },
  { id: "qualifying",   label: "Qualifying",   color: "amber-500",   hex: "#f59e0b" },
  { id: "follow_up",    label: "Follow Up",    color: "purple-500",  hex: "#a855f7" },
  { id: "negotiation",  label: "Negotiation",  color: "indigo-500",  hex: "#6366f1" },
  { id: "closing",      label: "Closing",      color: "emerald-500", hex: "#10b981" },
  { id: "won",          label: "Won",          color: "green-500",   hex: "#22c55e", collapsed: true },
  { id: "lost",         label: "Lost",         color: "red-500",     hex: "#ef4444", collapsed: true },
];

export const AGENT_COLORS: Record<string, string> = {
  research:  "bg-blue-100 text-blue-700",
  qualifier: "bg-amber-100 text-amber-700",
  followup:  "bg-violet-100 text-violet-700",
  pricer:    "bg-indigo-100 text-indigo-700",
  closer:    "bg-emerald-100 text-emerald-700",
  human:     "bg-slate-100 text-slate-700",
};
