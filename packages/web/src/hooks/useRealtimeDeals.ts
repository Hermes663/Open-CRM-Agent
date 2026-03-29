"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { Deal } from "@/lib/types";

export function useRealtimeDeals() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDeals = useCallback(async () => {
    const { data, error } = await supabase
      .from("deals")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching deals:", error);
      return;
    }
    setDeals((data as Deal[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDeals();

    const channel = supabase
      .channel("deals-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "deals" },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setDeals((prev) => [payload.new as Deal, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setDeals((prev) =>
              prev.map((d) =>
                d.id === (payload.new as Deal).id ? (payload.new as Deal) : d
              )
            );
          } else if (payload.eventType === "DELETE") {
            setDeals((prev) =>
              prev.filter((d) => d.id !== (payload.old as Deal).id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDeals]);

  return { deals, loading, refetch: fetchDeals };
}
