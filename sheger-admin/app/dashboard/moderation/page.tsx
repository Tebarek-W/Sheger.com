import { QueryError } from "@/components/admin/QueryError";
import { ReviewReportActions } from "@/components/admin/ReviewReportActions";
import { createClient } from "@/lib/supabase/server";

export default async function ModerationPage() {
  const supabase = await createClient();
  const { data: reports, error } = await supabase
    .from("review_reports")
    .select("id, reason, status, created_at, review_id, reporter_id")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return <QueryError title="Moderation" />;
  }

  const rows = reports ?? [];
  const reviewIds = [...new Set(rows.map((r) => r.review_id))];
  const reporterIds = [...new Set(rows.map((r) => r.reporter_id))];

  const [{ data: reviews }, { data: reporters }] = await Promise.all([
    reviewIds.length
      ? supabase
          .from("reviews")
          .select("id, rating, comment, is_hidden, business_id, customer_id, businesses(name), profiles:customer_id(full_name)")
          .in("id", reviewIds)
      : Promise.resolve({ data: [] as never[] }),
    reporterIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", reporterIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const reviewById = new Map((reviews ?? []).map((r) => [r.id, r]));
  const reporterById = new Map((reporters ?? []).map((r) => [r.id, r]));

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Moderation</h1>
      <p className="mt-2 text-[var(--muted)]">
        Review reports from the mobile app. Hide objectionable reviews or dismiss false reports.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface)] text-[var(--primary-dark)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Business</th>
              <th className="px-4 py-3 font-semibold">Review</th>
              <th className="px-4 py-3 font-semibold">Reason</th>
              <th className="px-4 py-3 font-semibold">Reporter</th>
              <th className="px-4 py-3 font-semibold">Reported</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((report) => {
              const review = reviewById.get(report.review_id) as
                | {
                    id: string;
                    rating: number;
                    comment: string | null;
                    is_hidden: boolean;
                    businesses: { name: string } | null;
                    profiles: { full_name: string | null } | null;
                  }
                | undefined;
              const reporter = reporterById.get(report.reporter_id);

              return (
                <tr key={report.id} className="border-t border-[var(--border)] align-top">
                  <td className="px-4 py-3 font-medium">
                    {review?.businesses?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">
                      {review?.rating ?? "—"}★ · {review?.profiles?.full_name || "Customer"}
                    </p>
                    <p className="mt-1 max-w-sm text-[var(--muted)]">
                      {review?.comment?.trim() || "No comment"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{report.reason}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {reporter?.full_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {new Date(report.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <ReviewReportActions
                        reportId={report.id}
                        reviewId={report.review_id}
                        reviewHidden={Boolean(review?.is_hidden)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="px-4 py-8 text-center text-[var(--muted)]">No open review reports.</p>
        ) : null}
      </div>
    </div>
  );
}
