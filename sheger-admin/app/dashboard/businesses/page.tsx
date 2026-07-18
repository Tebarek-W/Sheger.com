import Link from "next/link";

import { BusinessActions } from "@/components/admin/BusinessActions";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { summarizeDocumentApproval } from "@/lib/documents/approval";
import { createClient } from "@/lib/supabase/server";
import type { BusinessDocument } from "@/lib/types/database";

export default async function BusinessesPage() {
  const supabase = await createClient();
  const { data: businesses } = await supabase
    .from("businesses")
    .select("*, categories(name, slug), business_documents(document_type, status)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">
        Business approval
      </h1>
      <p className="mt-2 text-[var(--muted)]">
        Review license documents and approve businesses before they appear in the mobile app.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface)] text-[var(--primary-dark)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Business</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">City</th>
              <th className="px-4 py-3 font-semibold">Documents</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(businesses ?? []).map((biz) => {
              const categorySlug = (biz.categories as { slug: string } | null)?.slug ?? null;
              const documents =
                (biz.business_documents as Pick<
                  BusinessDocument,
                  "document_type" | "status"
                >[] | null) ?? [];
              const summary = summarizeDocumentApproval(categorySlug, documents, biz.status);

              return (
                <tr key={biz.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/businesses/${biz.id}`}
                      className="font-semibold text-[var(--primary-dark)] hover:underline"
                    >
                      {biz.name}
                    </Link>
                    <p className="text-xs text-[var(--muted)]">{biz.phone}</p>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {(biz.categories as { name: string } | null)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {biz.city || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        summary.allApproved
                          ? "bg-green-100 text-green-800"
                          : summary.allUploaded
                            ? "bg-amber-100 text-amber-900"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {summary.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={biz.status} />
                  </td>
                  <td className="px-4 py-3">
                    <BusinessActions
                      businessId={biz.id}
                      status={biz.status}
                      canApprove={summary.allApproved}
                      approveHint={
                        summary.allApproved
                          ? undefined
                          : summary.allUploaded
                            ? "Verify all documents on review page"
                            : "Missing required documents"
                      }
                      reviewHref={`/dashboard/businesses/${biz.id}`}
                    />
                  </td>
                </tr>
              );
            })}
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
