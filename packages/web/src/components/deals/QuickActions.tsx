'use client';

import { useState } from 'react';
import {
  Mail,
  StickyNote,
  ArrowRight,
  Search,
  AlertTriangle,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { PIPELINE_STAGES } from '@/lib/constants';
import type { PipelineStage } from '@/lib/types';

interface QuickActionsProps {
  dealId: string;
  currentStage: PipelineStage;
  onStageChange: (stage: PipelineStage) => void;
}

export default function QuickActions({
  dealId,
  currentStage,
  onStageChange,
}: QuickActionsProps) {
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);
  const [runningResearch, setRunningResearch] = useState(false);

  async function handleRunResearch() {
    setRunningResearch(true);
    try {
      await fetch(`/api/deals/${dealId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_type: 'research_completed',
          description: 'Manual research trigger',
        }),
      });
    } catch (err) {
      console.error('Failed to run research:', err);
    } finally {
      setTimeout(() => setRunningResearch(false), 2000);
    }
  }

  return (
    <div className="card space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        Quick Actions
      </h3>

      {/* Send Email */}
      <button className="btn-primary w-full justify-center">
        <Mail className="h-4 w-4" />
        Send Email
      </button>

      {/* Add Note */}
      <button className="btn-secondary w-full justify-center">
        <StickyNote className="h-4 w-4" />
        Add Note
      </button>

      {/* Change Stage */}
      <div className="relative">
        <button
          onClick={() => setStageDropdownOpen(!stageDropdownOpen)}
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

      {/* Run Research */}
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
        {runningResearch ? 'Researching...' : 'Run Research'}
      </button>

      {/* Escalate */}
      <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100">
        <AlertTriangle className="h-4 w-4" />
        Escalate to Human
      </button>
    </div>
  );
}
