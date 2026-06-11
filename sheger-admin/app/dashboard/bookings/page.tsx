import { BookingActions } from "@/components/admin/BookingActions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { createClient } from "@/lib/supabase/server";

export default async function BookingsPage() {
  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "*, businesses(name), services(name, price), profiles(full_name)",
    )
    .order("scheduled_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Bookings</h1>
      <p className="mt-2 text-[var(--muted)]">
        View and update booking statuses across the platform.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface)] text-[var(--primary-dark)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Business</th>
              <th className="px-4 py-3 font-semibold">Service</th>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Update</th>
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((booking) => (
              <tr key={booking.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">
                  {(booking.profiles as { full_name: string | null } | null)
                    ?.full_name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {(booking.businesses as { name: string } | null)?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <p>
                    {(booking.services as { name: string } | null)?.name ?? "—"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    ETB{" "}
                    {(booking.services as { price: number } | null)?.price ?? 0}
                  </p>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(booking.scheduled_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={booking.status} />
                </td>
                <td className="px-4 py-3">
                  <BookingActions bookingId={booking.id} status={booking.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!bookings?.length ? (
          <p className="p-8 text-center text-[var(--muted)]">No bookings yet.</p>
        ) : null}
      </div>
    </div>
  );
}
