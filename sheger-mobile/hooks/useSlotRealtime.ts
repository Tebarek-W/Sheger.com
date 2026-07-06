import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

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
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!businessId) return;

    const { start, endExclusive } = addisDayBounds(date);
    const rangeStart = new Date(start).getTime();
    const rangeEnd = new Date(endExclusive).getTime();
    const channelName = `slots-${businessId}-${dateKey}-${employeeId ?? "any"}`;
    let cancelled = false;

    const subscribe = async () => {
      // Supabase reuses channel instances by topic; tear down before re-binding.
      await supabase.removeChannel(supabase.channel(channelName));
      if (cancelled) return;

      const channel = supabase
        .channel(channelName)
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

      if (cancelled) {
        void supabase.removeChannel(channel);
        return;
      }

      channelRef.current = channel;
    };

    void subscribe();

    return () => {
      cancelled = true;
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [businessId, dateKey, employeeId, queryClient, date]);
}
