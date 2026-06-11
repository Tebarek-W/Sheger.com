import { BusinessActions } from "@/components/admin/BusinessActions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { createClient } from "@/lib/supabase/server";

export default async function BusinessesPage() {
  const supabase = await createClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("*, categories(name)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">
        Business approval
      </h1>
      <p className="mt-2 text-[var(--muted)]">
        Review and approve businesses before they appear in the mobile app.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface)] text-[var(--primary-dark)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Business</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">City</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(businesses ?? []).map((biz) => (
              <tr key={biz.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3">
                  <p className="font-semibold text-[var(--primary-dark)]">
                    {biz.name}
                  </p>
                  <p className="text-xs text-[var(--muted)]">{biz.phone}</p>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {(biz.categories as { name: string } | null)?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {biz.city || "—"}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={biz.status} />
                </td>
                <td className="px-4 py-3">
                  <BusinessActions businessId={biz.id} status={biz.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!businesses?.length ? (
          <p className="p-8 text-center text-[var(--muted)]">
            No businesses submitted yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
