'use client';

import {
  Mail,
  MailOpen,
  Search,
  ArrowRight,
  Brain,
  Plus,
  Clock,
  Activity as ActivityIcon,
} from 'lucide-react';
import { useRealtimeActivities } from '@/hooks/useRealtimeActivities';
import { formatRelativeTime } from '@/lib/utils';
import { AGENT_COLORS } from '@/lib/constants';
import type { ActivityType } from '@/lib/types';

const ACTIVITY_CONFIG: Record<
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

export default function AgentActivityFeed() {
  const { activities, loading } = useRealtimeActivities({ limit: 30 });

  if (loading) {
    return (
      <div className="card">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Agent Activity
        </h3>
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
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
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
          Live
        </span>
      </div>

      <div className="max-h-[480px] space-y-1 overflow-y-auto pr-1">
        {activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            No recent activity
          </p>
        ) : (
          activities.map((activity) => {
            const config =
              ACTIVITY_CONFIG[activity.activity_type as ActivityType] ??
              ACTIVITY_CONFIG.note_added;
            const Icon = config.icon;

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-slate-50"
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${config.bg}`}
                >
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 leading-snug">
                    {activity.description}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {formatRelativeTime(activity.created_at)}
                    </span>
                    {activity.agent_name && (
                      <span
                        className={`badge text-[10px] ${
                          AGENT_COLORS[activity.agent_name] ??
                          'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {activity.agent_name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
