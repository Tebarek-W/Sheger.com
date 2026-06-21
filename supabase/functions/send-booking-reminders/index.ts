import { adminClient, handleCors, jsonResponse } from "../_shared/supabase.ts";
import { deliverNotification, formatScheduledAt } from "../_shared/notifications.ts";

type BookingRow = {
  id: string;
  customer_id: string;
  business_id: string;
  service_id: string;
  scheduled_at: string;
  status: string;
};

type ReminderKind = "24h" | "1h";

async function sendReminder(
  supabase: ReturnType<typeof adminClient>,
  booking: BookingRow,
  kind: ReminderKind,
) {
  const [{ data: business }, { data: service }] = await Promise.all([
    supabase.from("businesses").select("name").eq("id", booking.business_id).single(),
    supabase.from("services").select("name").eq("id", booking.service_id).single(),
  ]);

  const businessName = business?.name ?? "your appointment";
  const serviceName = service?.name ?? "your service";
  const when = formatScheduledAt(booking.scheduled_at);

  const is24h = kind === "24h";
  const type = is24h ? "booking_reminder_24h" : "booking_reminder_1h";
  const title = is24h ? "Appointment tomorrow" : "Appointment in 1 hour";
  const body = is24h
    ? `Reminder: ${serviceName} at ${businessName} tomorrow (${when}).`
    : `Reminder: your ${serviceName} at ${businessName} starts in 1 hour (${when}).`;

  await deliverNotification(supabase, {
    userId: booking.customer_id,
    type,
    title,
    body,
    data: {
      booking_id: booking.id,
      business_id: booking.business_id,
      service_id: booking.service_id,
      reminder_kind: kind,
    },
  });

  const { error } = await supabase.from("booking_reminder_deliveries").insert({
    booking_id: booking.id,
    reminder_kind: kind,
  });

  if (error && error.code !== "23505") {
    throw error;
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = adminClient();
    const now = Date.now();

    const windows: { kind: ReminderKind; minMs: number; maxMs: number }[] = [
      { kind: "24h", minMs: 23.75 * 60 * 60 * 1000, maxMs: 24.25 * 60 * 60 * 1000 },
      { kind: "1h", minMs: 55 * 60 * 1000, maxMs: 65 * 60 * 1000 },
    ];

    let sent = 0;

    for (const window of windows) {
      const minAt = new Date(now + window.minMs).toISOString();
      const maxAt = new Date(now + window.maxMs).toISOString();

      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("id, customer_id, business_id, service_id, scheduled_at, status")
        .eq("status", "confirmed")
        .gte("scheduled_at", minAt)
        .lte("scheduled_at", maxAt);

      if (error) throw error;

      for (const booking of (bookings ?? []) as BookingRow[]) {
        const { data: existing } = await supabase
          .from("booking_reminder_deliveries")
          .select("id")
          .eq("booking_id", booking.id)
          .eq("reminder_kind", window.kind)
          .maybeSingle();

        if (existing) continue;

        await sendReminder(supabase, booking, window.kind);
        sent += 1;
      }
    }

    return jsonResponse({ ok: true, sent });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return jsonResponse({ error: message }, 500);
  }
});
