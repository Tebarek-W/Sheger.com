import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatBookingPrice, getBookingRevenueAmount } from "@/lib/services/pricing";
import { createClient } from "@/lib/supabase/server";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("*, businesses(name), services(name, price)")
    .not("payment_method", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const total =
    bookings?.reduce((sum, b) => sum + getBookingRevenueAmount(b), 0) ?? 0;

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Payments</h1>
      <p className="mt-2 text-[var(--muted)]">
        Payment methods recorded at booking time (MVP — no live gateway).
      </p>

      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <p className="text-sm font-semibold text-[var(--muted)]">
          Total recorded (last 100)
        </p>
        <p className="mt-1 text-3xl font-extrabold text-[var(--primary-dark)]">
          ETB {total.toLocaleString()}
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface)] text-[var(--primary-dark)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Business</th>
              <th className="px-4 py-3 font-semibold">Service</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Method</th>
              <th className="px-4 py-3 font-semibold">Booking status</th>
              <th className="px-4 py-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((booking) => (
              <tr key={booking.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">
                  {(booking.businesses as { name: string } | null)?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {(booking.services as { name: string } | null)?.name ?? "—"}
                </td>
                <td className="px-4 py-3 font-semibold text-[var(--primary-dark)]">
                  {formatBookingPrice(booking)}
                </td>
                <td className="px-4 py-3 capitalize text-[var(--muted)]">
                  {booking.payment_method?.replace("_", " ") ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={booking.status} />
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(booking.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!bookings?.length ? (
          <p className="p-8 text-center text-[var(--muted)]">
            No payments recorded yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
