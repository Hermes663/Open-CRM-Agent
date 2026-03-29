'use client';

import { useState } from 'react';
import {
  Mail,
  MailOpen,
  Search,
  ArrowRight,
  Brain,
  Plus,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity as ActivityIcon,
} from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { AGENT_COLORS } from '@/lib/constants';
import type { Activity, ActivityType } from '@/lib/types';

const ACTIVITY_ICONS: Record<
  ActivityType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  email_sent:          { icon: Mail,         color: 'text-blue-600',    bg: 'bg-blue-100' },
  email_received:      { icon: MailOpen,     color: 'text-emerald-600', bg: 'bg-emerald-100' },
  research_completed:  { icon: Search,       color: 'text-purple-600',  bg: 'bg-purple-100' },
  stage_changed:       { icon: ArrowRight,   color: 'text-amber-600',   bg: 'bg-amber-100' },
  agent_decision:      { icon: Brain,        color: 'text-indigo-600',  bg: 'bg-indigo-100' },
  deal_created:        { icon: Plus,         color: 'text-slate-600',   bg: 'bg-slate-100' },
  follow_up_sent:      { icon: Clock,        color: 'text-orange-600',  bg: 'bg-orange-100' },
  note_added:          { icon: Plus,         color: 'text-slate-500',   bg: 'bg-slate-100' },
  call_logged:         { icon: ActivityIcon, color: 'text-teal-600',    bg: 'bg-teal-100' },
};

function ActivityEntry({ activity, isLast }: { activity: Activity; isLast: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const config =
    ACTIVITY_ICONS[activity.activity_type as ActivityType] ??
    ACTIVITY_ICONS.note_added;
  const Icon = config.icon;
  const hasBody = !!activity.body;

  return (
    <div className="relative flex gap-4">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-[15px] top-10 h-[calc(100%-16px)] w-px bg-slate-200" />
      )}

      {/* Dot */}
      <div
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${config.bg}`}
      >
        <Icon className={`h-4 w-4 ${config.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-slate-800">
              {activity.description}
            </p>
            <span className="shrink-0 text-xs text-slate-400">
              {formatRelativeTime(activity.created_at)}
            </span>
          </div>

          {activity.agent_name && (
            <span
              className={`badge mt-2 text-[10px] ${
                AGENT_COLORS[activity.agent_name] ?? 'bg-slate-100 text-slate-600'
              }`}
            >
              {activity.agent_name}
            </span>
          )}

          {/* Expandable body (for emails) */}
          {hasBody && (
            <div className="mt-2 border-t border-slate-100 pt-2">
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" /> Hide content
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" /> Show content
                  </>
                )}
              </button>
              {expanded && (
                <div className="mt-2 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs text-slate-700 leading-relaxed">
                  {activity.body}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ActivityTimelineProps {
  activities: Activity[];
}

export default function ActivityTimeline({ activities }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <div className="card flex items-center justify-center py-12">
        <p className="text-sm text-slate-400">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="mb-5 text-sm font-semibold uppercase tracking-wider text-slate-500">
        Activity Timeline
      </h3>
      <div>
        {activities.map((activity, idx) => (
          <ActivityEntry
            key={activity.id}
            activity={activity}
            isLast={idx === activities.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
