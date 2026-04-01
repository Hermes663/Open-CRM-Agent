"use client";

import { useCallback, useMemo } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";

import { PIPELINE_STAGES } from "@/lib/constants";
import type { Deal, PipelineStage } from "@/lib/types";

import StageColumn from "./StageColumn";

interface KanbanBoardProps {
  deals: Deal[];
  onStageChange: (dealId: string, stage: PipelineStage) => Promise<void>;
}

export default function KanbanBoard({
  deals,
  onStageChange,
}: KanbanBoardProps) {
  const dealsByStage = useMemo(() => {
    const grouped: Record<PipelineStage, Deal[]> = {
      new_deal: [],
      first_email: [],
      qualifying: [],
      follow_up: [],
      negotiation: [],
      closing: [],
      won: [],
      lost: [],
    };

    for (const deal of deals) {
      if (grouped[deal.stage]) {
        grouped[deal.stage].push(deal);
      }
    }

    return grouped;
  }, [deals]);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { draggableId, destination, source } = result;
      if (!destination) {
        return;
      }

      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      try {
        await onStageChange(
          draggableId,
          destination.droppableId as PipelineStage,
        );
      } catch (error) {
        console.error("Failed to update deal stage:", error);
      }
    },
    [onStageChange],
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto px-1 pb-4 pt-1">
        {PIPELINE_STAGES.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            deals={dealsByStage[stage.id]}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
