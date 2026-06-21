import { adminClient, handleCors, jsonResponse } from "../_shared/supabase.ts";
import { deliverNotification, formatScheduledAt } from "../_shared/notifications.ts";

type BookingRow = {
  id: string;
  customer_id: string;
  business_id: string;
  service_id: string;
  status: string;
  scheduled_at: string;
};

type WebhookPayload = {
  type: "INSERT" | "UPDATE";
  table: string;
  record: BookingRow;
  old_record?: BookingRow | null;
};

async function loadBookingContext(supabase: ReturnType<typeof adminClient>, booking: BookingRow) {
  const [{ data: business }, { data: service }] = await Promise.all([
    supabase.from("businesses").select("name, owner_id").eq("id", booking.business_id).single(),
    supabase.from("services").select("name").eq("id", booking.service_id).single(),
  ]);

  return {
    businessName: business?.name ?? "the business",
    ownerId: business?.owner_id ?? null,
    serviceName: service?.name ?? "your service",
    when: formatScheduledAt(booking.scheduled_at),
  };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const payload = (await req.json()) as WebhookPayload;
    if (payload.table !== "bookings") {
      return jsonResponse({ skipped: true, reason: "not bookings table" });
    }

    const booking = payload.record;
    const oldBooking = payload.old_record ?? null;
    const supabase = adminClient();
    const ctx = await loadBookingContext(supabase, booking);

    const data = {
      booking_id: booking.id,
      business_id: booking.business_id,
      service_id: booking.service_id,
    };

    if (payload.type === "INSERT" && booking.status === "pending" && ctx.ownerId) {
      await deliverNotification(supabase, {
        userId: ctx.ownerId,
        type: "booking_new",
        title: "New booking request",
        body: `New ${ctx.serviceName} booking at ${ctx.businessName} for ${ctx.when}.`,
        data,
      });
      return jsonResponse({ ok: true, event: "booking_new" });
    }

    if (payload.type === "UPDATE") {
      if (oldBooking?.status === "pending" && booking.status === "confirmed") {
        await deliverNotification(supabase, {
          userId: booking.customer_id,
          type: "booking_confirmed",
          title: "Booking confirmed",
          body: `Your ${ctx.serviceName} at ${ctx.businessName} is confirmed for ${ctx.when}.`,
          data,
        });
        return jsonResponse({ ok: true, event: "booking_confirmed" });
      }

      if (booking.status === "cancelled" && oldBooking?.status !== "cancelled") {
        const recipients: { userId: string; body: string }[] = [];

        if (oldBooking?.status === "confirmed") {
          recipients.push({
            userId: booking.customer_id,
            body: `Your ${ctx.serviceName} at ${ctx.businessName} on ${ctx.when} was cancelled.`,
          });
        } else if (oldBooking?.status === "pending") {
          if (ctx.ownerId) {
            recipients.push({
              userId: ctx.ownerId,
              body: `The ${ctx.serviceName} booking at ${ctx.businessName} on ${ctx.when} was cancelled.`,
            });
          }
          recipients.push({
            userId: booking.customer_id,
            body: `Your ${ctx.serviceName} booking at ${ctx.businessName} on ${ctx.when} was cancelled.`,
          });
        }

        for (const recipient of recipients) {
          await deliverNotification(supabase, {
            userId: recipient.userId,
            type: "booking_cancelled",
            title: "Booking cancelled",
            body: recipient.body,
            data,
          });
        }
        return jsonResponse({ ok: true, event: "booking_cancelled" });
      }
    }

    return jsonResponse({ ok: true, skipped: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return jsonResponse({ error: message }, 500);
  }
});
