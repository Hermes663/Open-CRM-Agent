"use client";

import { Droppable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import type { Deal, StageConfig } from "@/lib/types";
import DealCard from "./DealCard";

interface StageColumnProps {
  stage: StageConfig;
  deals: Deal[];
}

export default function StageColumn({ stage, deals }: StageColumnProps) {
  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);
  const isCollapsed = stage.collapsed && deals.length === 0;

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl bg-slate-50/80",
        stage.collapsed ? "min-w-[180px] w-[180px]" : "min-w-[280px] w-[280px]"
      )}
    >
      {/* Column header */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <div
          className="mb-2 h-1 rounded-full"
          style={{ backgroundColor: stage.hex }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              {stage.label}
            </h3>
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-600">
              {deals.length}
            </span>
          </div>
          {!stage.collapsed && totalValue > 0 && (
            <span className="text-[11px] font-medium text-slate-500">
              {formatCurrency(totalValue, "EUR")}
            </span>
          )}
        </div>
      </div>

      {/* Droppable area */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 space-y-2 overflow-y-auto px-2 pb-2 transition-colors rounded-b-xl",
              snapshot.isDraggingOver && "bg-primary-50/50",
              isCollapsed && "min-h-[60px]"
            )}
            style={{ maxHeight: "calc(100vh - 240px)" }}
          >
            {deals.map((deal, idx) => (
              <DealCard key={deal.id} deal={deal} index={idx} />
            ))}
            {provided.placeholder}

            {deals.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400">
                Drop deals here
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
