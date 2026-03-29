"use client";

import { Draggable } from "@hello-pangea/dnd";
import { useRouter } from "next/navigation";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { AGENT_COLORS } from "@/lib/constants";
import type { Deal } from "@/lib/types";

interface DealCardProps {
  deal: Deal;
  index: number;
}

function daysInStage(stageEnteredAt: string): number {
  const entered = new Date(stageEnteredAt);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - entered.getTime()) / 86_400_000));
}

function priorityDot(score: number) {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-400";
  return "bg-red-500";
}

export default function DealCard({ deal, index }: DealCardProps) {
  const router = useRouter();
  const days = daysInStage(deal.stage_entered_at);
  const agentColorClass = deal.agent_name
    ? AGENT_COLORS[deal.agent_name] ?? "bg-slate-100 text-slate-600"
    : null;

  return (
    <Draggable draggableId={deal.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => router.push(`/deals/${deal.id}`)}
          className={cn(
            "group cursor-pointer rounded-lg border bg-white p-3 transition-shadow select-none",
            snapshot.isDragging
              ? "shadow-lg ring-2 ring-primary-400/40"
              : "shadow-sm hover:shadow-md border-slate-200"
          )}
        >
          {/* Row 1: company + value */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={cn(
                  "h-2 w-2 flex-shrink-0 rounded-full",
                  priorityDot(deal.priority_score)
                )}
              />
              <span className="truncate text-sm font-semibold text-slate-900">
                {deal.company_name}
              </span>
            </div>
            <span className="flex-shrink-0 text-sm font-bold text-slate-800">
              {formatCurrency(deal.value, "EUR")}
            </span>
          </div>

          {/* Row 2: contact + badges */}
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="truncate text-xs text-slate-500">
              {deal.contact_name ?? "\u2014"}
            </span>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {deal.agent_name && agentColorClass && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none",
                    agentColorClass
                  )}
                >
                  <Bot className="h-2.5 w-2.5" />
                  {deal.agent_name}
                </span>
              )}
              <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium leading-none text-slate-500">
                {days}d
              </span>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
