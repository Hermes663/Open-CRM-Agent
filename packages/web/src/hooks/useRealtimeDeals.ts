"use client";

import { useCallback, useEffect, useState } from "react";

import { getDeals, updateDeal } from "@/lib/api";
import type { Deal, PipelineStage } from "@/lib/types";

const DEALS_POLL_INTERVAL_MS = 15000;

export function useRealtimeDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingDealId, setUpdatingDealId] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    try {
      const data = await getDeals();
      setDeals(data);
    } catch (error) {
      console.error("Failed to fetch deals:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateDealStage = useCallback(
    async (dealId: string, stage: PipelineStage) => {
      const previousDeals = deals;
      const optimisticUpdatedAt = new Date().toISOString();

      setUpdatingDealId(dealId);
      setDeals((current) =>
        current.map((deal) =>
          deal.id === dealId
            ? {
                ...deal,
                stage,
                stage_entered_at: optimisticUpdatedAt,
                updated_at: optimisticUpdatedAt,
              }
            : deal,
        ),
      );

      try {
        const updatedDeal = await updateDeal(dealId, { stage });
        setDeals((current) =>
          current.map((deal) => (deal.id === dealId ? updatedDeal : deal)),
        );
      } catch (error) {
        console.error("Failed to update deal stage:", error);
        setDeals(previousDeals);
        throw error;
      } finally {
        setUpdatingDealId(null);
      }
    },
    [deals],
  );

  useEffect(() => {
    void fetchDeals();

    const interval = window.setInterval(() => {
      void fetchDeals();
    }, DEALS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchDeals]);

  return {
    deals,
    loading,
    updatingDealId,
    refetch: fetchDeals,
    updateDealStage,
  };
}
