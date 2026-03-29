'use client';

import { useState } from 'react';
import { Calendar, Clock, Tag, ChevronDown } from 'lucide-react';
import { PIPELINE_STAGES, AGENT_COLORS } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Deal, PipelineStage } from '@/lib/types';

interface DealInfoCardProps {
  deal: Deal;
  onStageChange: (stage: PipelineStage) => void;
}

export default function DealInfoCard({ deal, onStageChange }: DealInfoCardProps) {
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);

  const currentStage = PIPELINE_STAGES.find((s) => s.id === deal.stage);
  const daysInStage = Math.floor(
    (Date.now() - new Date(deal.stage_entered_at).getTime()) / 86400000
  );

  const priorityColor =
    deal.priority_score >= 70
      ? 'bg-emerald-500'
      : deal.priority_score >= 40
        ? 'bg-amber-500'
        : 'bg-red-500';

  return (
    <div className="card space-y-5">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
        Deal Info
      </h3>

      {/* Stage badge */}
      <div>
        <label className="text-xs font-medium text-slate-400">Stage</label>
        <div className="relative mt-1">
          <button
            onClick={() => setStageDropdownOpen(!stageDropdownOpen)}
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm transition-colors hover:bg-slate-50"
          >
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: currentStage?.hex }}
              />
              {currentStage?.label ?? deal.stage}
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
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
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
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
      </div>

      {/* Value */}
      <div>
        <label className="text-xs font-medium text-slate-400">Value</label>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          {formatCurrency(deal.value, 'EUR')}
        </p>
      </div>

      {/* Agent */}
      {deal.agent_name && (
        <div>
          <label className="text-xs font-medium text-slate-400">Assigned Agent</label>
          <div className="mt-1">
            <span
              className={`badge ${
                AGENT_COLORS[deal.agent_name] ?? 'bg-slate-100 text-slate-600'
              }`}
            >
              {deal.agent_name}
            </span>
          </div>
        </div>
      )}

      {/* Priority */}
      <div>
        <label className="text-xs font-medium text-slate-400">
          Priority Score
        </label>
        <div className="mt-1.5 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${priorityColor} transition-all`}
              style={{ width: `${deal.priority_score}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-slate-700">
            {deal.priority_score}
          </span>
        </div>
      </div>

      {/* Expected close date */}
      {deal.expected_close_date && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar className="h-4 w-4 text-slate-400" />
          <span>Close: {formatDate(deal.expected_close_date)}</span>
        </div>
      )}

      {/* Days in stage */}
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Clock className="h-4 w-4 text-slate-400" />
        <span>
          {daysInStage} day{daysInStage !== 1 ? 's' : ''} in stage
        </span>
      </div>

      {/* Tags */}
      {deal.tags && deal.tags.length > 0 && (
        <div>
          <label className="text-xs font-medium text-slate-400">Tags</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {deal.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Created date */}
      <div className="border-t border-slate-100 pt-3 text-xs text-slate-400">
        Created {formatDate(deal.created_at)}
      </div>
    </div>
  );
}
