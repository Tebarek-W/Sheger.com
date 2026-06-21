import Link from "next/link";
import { notFound } from "next/navigation";

import { BusinessActions } from "@/components/admin/BusinessActions";
import { BusinessDocumentReview } from "@/components/admin/BusinessDocumentReview";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { summarizeDocumentApproval } from "@/lib/documents/approval";
import { getRequiredDocumentTypes } from "@/lib/documents/license";
import { createClient } from "@/lib/supabase/server";
import type { BusinessDocument } from "@/lib/types/database";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("*, categories(name, slug), profiles!businesses_owner_id_fkey(full_name, phone)")
    .eq("id", id)
    .maybeSingle();

  if (businessError) {
    throw new Error(businessError.message);
  }

  if (!business) notFound();

  const { data: documents, error: documentsError } = await supabase
    .from("business_documents")
    .select("*")
    .eq("business_id", id)
    .order("created_at");

  if (documentsError) {
    throw new Error(documentsError.message);
  }

  const categorySlug = (business.categories as { slug: string } | null)?.slug ?? null;
  const requiredTypes = getRequiredDocumentTypes(categorySlug);
  const summary = summarizeDocumentApproval(
    categorySlug,
    (documents ?? []) as BusinessDocument[],
    business.status,
  );
  const owner = business.profiles as {
    full_name: string | null;
    phone: string | null;
  } | null;

  return (
    <div>
      <Link
        href="/dashboard/businesses"
        className="text-sm font-semibold text-[var(--primary)] hover:underline"
      >
        ← Back to businesses
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--primary-dark)]">{business.name}</h1>
          <p className="mt-2 text-[var(--muted)]">
            {(business.categories as { name: string } | null)?.name ?? "—"} · {business.city || "—"}
          </p>
        </div>
        <StatusBadge status={business.status} />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <p className="text-sm font-semibold text-[var(--muted)]">Owner</p>
          <p className="mt-1 font-semibold text-[var(--primary-dark)]">
            {owner?.full_name ?? "—"}
          </p>
          <p className="text-sm text-[var(--muted)]">{owner?.phone ?? business.phone ?? "—"}</p>
          <p className="text-sm text-[var(--muted)]">{business.email ?? "—"}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-5">
          <p className="text-sm font-semibold text-[var(--muted)]">Address</p>
          <p className="mt-1 text-[var(--primary-dark)]">{business.address || "—"}</p>
          {business.description ? (
            <p className="mt-3 text-sm text-[var(--muted)]">{business.description}</p>
          ) : null}
        </div>
      </div>

      <BusinessDocumentReview
        businessId={business.id}
        categorySlug={categorySlug}
        documents={(documents ?? []) as BusinessDocument[]}
        requiredTypes={requiredTypes}
      />

      <div className="mt-8 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-lg font-bold text-[var(--primary-dark)]">Business status</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Documents: {summary.label}. Approve the business only after all required documents are
          verified.
        </p>
        <div className="mt-4">
          <BusinessActions
            businessId={business.id}
            status={business.status}
            canApprove={summary.allApproved}
            approveHint={
              summary.allApproved
                ? undefined
                : summary.allUploaded
                  ? "Approve each license document first"
                  : "Required license documents are missing"
            }
            reviewHref={`/dashboard/businesses/${business.id}`}
          />
        </div>
      </div>
    </div>
  );
}
