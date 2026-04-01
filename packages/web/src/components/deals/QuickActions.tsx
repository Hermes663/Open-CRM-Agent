"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Loader2,
  Mail,
  Search,
  StickyNote,
} from "lucide-react";

import { addActivity, runAgent } from "@/lib/api";
import { PIPELINE_STAGES } from "@/lib/constants";
import type { PipelineStage } from "@/lib/types";

interface QuickActionsProps {
  dealId: string;
  currentStage: PipelineStage;
  onStageChange: (stage: PipelineStage) => void;
  onRefresh?: () => Promise<void>;
}

export default function QuickActions({
  dealId,
  currentStage,
  onStageChange,
  onRefresh,
}: QuickActionsProps) {
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  const [runningResearch, setRunningResearch] = useState(false);
  const [runningQualifier, setRunningQualifier] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [escalating, setEscalating] = useState(false);

  async function handleRunResearch() {
    setRunningResearch(true);
    try {
      await runAgent("research", dealId);
      await onRefresh?.();
    } catch (error) {
      console.error("Failed to run research:", error);
    } finally {
      setRunningResearch(false);
    }
  }

  async function handleSendEmail() {
    setRunningQualifier(true);
    try {
      await runAgent("qualifier", dealId);
      await onRefresh?.();
    } catch (error) {
      console.error("Failed to run qualifier:", error);
    } finally {
      setRunningQualifier(false);
    }
  }

  async function handleAddNote() {
    const note = window.prompt("Add a note to this deal:");
    if (!note?.trim()) {
      return;
    }

    setSavingNote(true);
    try {
      await addActivity(dealId, {
        activity_type: "note_added",
        description: note.trim(),
        body: note.trim(),
        created_by: "web",
      });
      await onRefresh?.();
    } catch (error) {
      console.error("Failed to add note:", error);
    } finally {
      setSavingNote(false);
    }
  }

  async function handleEscalate() {
    setEscalating(true);
    try {
      await addActivity(dealId, {
        activity_type: "escalated_to_human",
        description: "Escalated to human operator",
        metadata: { escalated_from: currentStage },
        created_by: "web",
      });
      await onRefresh?.();
    } catch (error) {
      console.error("Failed to escalate deal:", error);
    } finally {
      setEscalating(false);
    }
  }

  return (
    <div className="card space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        Quick Actions
      </h3>

      <button
        onClick={handleSendEmail}
        disabled={runningQualifier}
        className="btn-primary w-full justify-center"
      >
        {runningQualifier ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mail className="h-4 w-4" />
        )}
        {runningQualifier ? "Sending..." : "Send Qualification Email"}
      </button>

      <button
        onClick={handleAddNote}
        disabled={savingNote}
        className="btn-secondary w-full justify-center"
      >
        {savingNote ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <StickyNote className="h-4 w-4" />
        )}
        {savingNote ? "Saving..." : "Add Note"}
      </button>

      <div className="relative">
        <button
          onClick={() => setStageDropdownOpen((open) => !open)}
          className="btn-secondary w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4" />
            Change Stage
          </span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {stageDropdownOpen && (
          <div className="absolute left-0 top-full z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            {PIPELINE_STAGES.map((stage) => (
              <button
                key={stage.id}
                onClick={() => {
                  onStageChange(stage.id);
                  setStageDropdownOpen(false);
                }}
                disabled={stage.id === currentStage}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: stage.hex }}
                />
                {stage.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleRunResearch}
        disabled={runningResearch}
        className="btn-secondary w-full justify-center"
      >
        {runningResearch ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
        {runningResearch ? "Researching..." : "Run Research"}
      </button>

      <button
        onClick={handleEscalate}
        disabled={escalating}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
      >
        {escalating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <AlertTriangle className="h-4 w-4" />
        )}
        {escalating ? "Escalating..." : "Escalate to Human"}
      </button>
    </div>
  );
}
