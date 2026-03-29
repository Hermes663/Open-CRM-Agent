"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { getRecentActivities, getActivities } from "@/lib/api";
import type { Activity } from "@/lib/types";

interface UseRealtimeActivitiesOptions {
  dealId?: string;
  limit?: number;
}

export function useRealtimeActivities(
  options: UseRealtimeActivitiesOptions = {}
) {
  const { dealId, limit = 20 } = options;
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const data = dealId
        ? await getActivities(dealId)
        : await getRecentActivities(limit);
      setActivities(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch activities")
      );
    } finally {
      setLoading(false);
    }
  }, [dealId, limit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    const supabase = createClient();

    const filter = dealId ? `deal_id=eq.${dealId}` : undefined;

    const channel = supabase
      .channel(`activities-realtime-${dealId ?? "global"}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activities",
          ...(filter ? { filter } : {}),
        },
        (payload) => {
          const newActivity = payload.new as Activity;
          setActivities((prev) => {
            const updated = [newActivity, ...prev];
            return updated.slice(0, limit);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId, limit]);

  return { activities, loading, error, refetch: fetchActivities };
}
