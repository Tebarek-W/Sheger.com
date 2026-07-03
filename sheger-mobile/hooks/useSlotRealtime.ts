import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { addisDayBounds } from "@/lib/calendar/timezone";
import { supabase } from "@/lib/supabase";

type BookingRow = {
  scheduled_at?: string;
  business_id?: string;
};

/** Invalidate slot queries when bookings change for this business/day. */
export function useSlotRealtimeRefresh(
  businessId: string | undefined,
  date: Date,
  employeeId?: string | null,
) {
  const queryClient = useQueryClient();
  const dateKey = date.toDateString();

  useEffect(() => {
    if (!businessId) return;

    const { start, endExclusive } = addisDayBounds(date);
    const rangeStart = new Date(start).getTime();
    const rangeEnd = new Date(endExclusive).getTime();

    const channel = supabase
      .channel(`slots-${businessId}-${dateKey}-${employeeId ?? "any"}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as BookingRow | null;
          if (!row?.scheduled_at) return;

          const instant = new Date(row.scheduled_at).getTime();
          if (instant < rangeStart || instant >= rangeEnd) return;

          queryClient.invalidateQueries({
            queryKey: ["available-slots", businessId, dateKey, employeeId ?? null],
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [businessId, dateKey, employeeId, queryClient, date]);
}
