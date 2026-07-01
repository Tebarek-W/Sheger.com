import { formatCommissionPercent } from "@/lib/commission";
import { paymentMethodLabel } from "@/lib/payment/methods";
import { createAdminClient } from "@/lib/supabase/admin";

type FinancialRow = {
  id: string;
  booking_id: string;
  business_id: string;
  service_price_etb: number;
  commission_rate: number;
  commission_amount_etb: number;
  platform_fee_etb: number;
  owner_net_etb: number;
  created_at: string;
  bookings: {
    payment_method: string | null;
    payment_status: string;
    status: string;
    businesses: { name: string } | null;
    services: { name: string } | null;
  } | null;
};

function sumField(rows: FinancialRow[], field: keyof FinancialRow): number {
  return rows.reduce((total, row) => total + Number(row[field] ?? 0), 0);
}

export default async function PaymentsPage() {
  const supabase = createAdminClient();

  const { data: financials, error } = await supabase
    .from("booking_financials")
    .select(
      `
      id,
      booking_id,
      business_id,
      service_price_etb,
      commission_rate,
      commission_amount_etb,
      platform_fee_etb,
      owner_net_etb,
      created_at,
      bookings!inner (
        payment_method,
        payment_status,
        status,
        businesses ( name ),
        services ( name )
      )
    `,
    )
    .eq("bookings.payment_status", "paid")
    .gt("service_price_etb", 0)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Platform commissions</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Commission data is unavailable until migration{" "}
          <code className="font-mono text-xs">20250629120001_chapa_split_payments.sql</code> is
          applied.
        </p>
      </div>
    );
  }

  const rows = (financials ?? []) as FinancialRow[];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentRows = rows.filter((row) => new Date(row.created_at).getTime() >= thirtyDaysAgo);

  const totalGross = sumField(rows, "service_price_etb");
  const totalCommission = sumField(rows, "platform_fee_etb");
  const totalOwnerNet = sumField(rows, "owner_net_etb");
  const commission30d = sumField(recentRows, "platform_fee_etb");

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Platform commissions</h1>
      <p className="mt-2 text-[var(--muted)]">
        Sheger&apos;s share from successful Chapa split payments (last 100 recorded bookings).
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm font-semibold text-[var(--muted)]">Commission received</p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--primary-dark)]">
            ETB {totalCommission.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
          <p className="text-sm font-semibold text-[var(--muted)]">Last 30 days</p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--primary-dark)]">
            ETB {commission30d.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
          <p className="text-sm font-semibold text-[var(--muted)]">Gross processed</p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--primary-dark)]">
            ETB {totalGross.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
          <p className="text-sm font-semibold text-[var(--muted)]">Paid to merchants</p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--primary-dark)]">
            ETB {totalOwnerNet.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface)] text-[var(--primary-dark)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Business</th>
              <th className="px-4 py-3 font-semibold">Service</th>
              <th className="px-4 py-3 font-semibold">Gross</th>
              <th className="px-4 py-3 font-semibold">Rate</th>
              <th className="px-4 py-3 font-semibold">Commission</th>
              <th className="px-4 py-3 font-semibold">Merchant net</th>
              <th className="px-4 py-3 font-semibold">Method</th>
              <th className="px-4 py-3 font-semibold">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">
                  {row.bookings?.businesses?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {row.bookings?.services?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  ETB {Number(row.service_price_etb).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {formatCommissionPercent(Number(row.commission_rate))}
                </td>
                <td className="px-4 py-3 font-semibold text-[var(--primary-dark)]">
                  ETB {Number(row.platform_fee_etb).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  ETB {Number(row.owner_net_etb).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {paymentMethodLabel(row.bookings?.payment_method)}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(row.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="p-8 text-center text-[var(--muted)]">
            No split-payment commissions recorded yet. Commissions appear here after successful Chapa
            online payments.
          </p>
        ) : null}
      </div>
    </div>
  );
}
