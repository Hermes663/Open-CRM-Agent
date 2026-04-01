"use client";

import { useCallback, useEffect, useState } from "react";

import { getActivities } from "@/lib/api";
import type { Activity } from "@/lib/types";

interface UseRealtimeActivitiesOptions {
  dealId?: string;
}

const ACTIVITIES_POLL_INTERVAL_MS = 10000;

export function useRealtimeActivities(
  options: UseRealtimeActivitiesOptions = {},
) {
  const { dealId } = options;
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchActivities = useCallback(async () => {
    if (!dealId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    try {
      const data = await getActivities(dealId);
      setActivities(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch activities"),
      );
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void fetchActivities();

    if (!dealId) {
      return;
    }

    const interval = window.setInterval(() => {
      void fetchActivities();
    }, ACTIVITIES_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [dealId, fetchActivities]);

  return { activities, loading, error, refetch: fetchActivities };
}
