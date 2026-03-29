"use client";

import { useCallback, useMemo } from "react";
import { DragDropContext, type DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/lib/supabase";
import { PIPELINE_STAGES } from "@/lib/constants";
import type { Deal, PipelineStage } from "@/lib/types";
import StageColumn from "./StageColumn";

interface KanbanBoardProps {
  deals: Deal[];
}

export default function KanbanBoard({ deals }: KanbanBoardProps) {
  // Group deals by stage
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

  const onDragEnd = useCallback(
    async (result: DropResult) => {
      const { draggableId, destination, source } = result;
      if (!destination) return;
      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const newStage = destination.droppableId as PipelineStage;

      // Optimistic: we rely on realtime subscription to update state
      const { error } = await supabase
        .from("deals")
        .update({
          stage: newStage,
          stage_entered_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", draggableId);

      if (error) {
        console.error("Failed to update deal stage:", error);
      }
    },
    []
  );

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 px-1">
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
