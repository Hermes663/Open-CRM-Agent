"use client";

import { useCallback, useEffect, useState } from "react";

import { getAgentRuns } from "@/lib/api";
import type { AgentRun } from "@/lib/types";

const AGENT_RUNS_POLL_INTERVAL_MS = 15000;

export function useAgentRuns(limit = 20) {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      const data = await getAgentRuns(limit);
      setRuns(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch agent runs"),
      );
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void fetchRuns();

    const interval = window.setInterval(() => {
      void fetchRuns();
    }, AGENT_RUNS_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchRuns]);

  return { runs, loading, error, refetch: fetchRuns };
}
