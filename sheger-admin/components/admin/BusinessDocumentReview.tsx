"use client";

import { useState, useTransition } from "react";

import {
  getBusinessLicenseSignedUrl,
  reviewBusinessDocument,
} from "@/app/actions/admin";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/license";
import type { BusinessDocument, BusinessDocumentType } from "@/lib/types/database";

type BusinessDocumentReviewProps = {
  businessId: string;
  categorySlug: string | null;
  documents: BusinessDocument[];
  requiredTypes: BusinessDocumentType[];
};

export function BusinessDocumentReview({
  businessId,
  documents,
  requiredTypes,
}: BusinessDocumentReviewProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const docByType = new Map(documents.map((d) => [d.document_type, d]));

  const openDocument = (storagePath: string) => {
    startTransition(async () => {
      try {
        const url = await getBusinessLicenseSignedUrl(storagePath);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not open document");
      }
    });
  };

  const review = (documentId: string, status: "approved" | "rejected", reason?: string) => {
    startTransition(async () => {
      try {
        await reviewBusinessDocument(documentId, status, reason);
        setMessage(status === "approved" ? "Document approved." : "Document rejected.");
        setRejectingId(null);
        setRejectReason("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Review failed");
      }
    });
  };

  return (
    <div className="mt-8 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[var(--primary-dark)]">License documents</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Review each required document before approving this business.
        </p>
      </div>

      {message ? (
        <p className="rounded-xl bg-[var(--primary-light)] px-4 py-3 text-sm text-[var(--primary-dark)]">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4">
        {requiredTypes.map((type) => {
          const doc = docByType.get(type);
          const label = DOCUMENT_TYPE_LABELS[type];

          return (
            <div
              key={type}
              className="rounded-2xl border border-[var(--border)] bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--primary-dark)]">{label}</p>
                  {doc ? (
                    <>
                      <p className="mt-1 text-sm text-[var(--muted)]">{doc.file_name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {(doc.file_size_bytes / 1024).toFixed(1)} KB · {doc.mime_type}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-red-600">Not uploaded</p>
                  )}
                </div>
                {doc ? (
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                      doc.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : doc.status === "rejected"
                          ? "bg-red-100 text-red-800"
                          : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {doc.status.replace("_", " ")}
                  </span>
                ) : null}
              </div>

              {doc?.rejection_reason ? (
                <p className="mt-3 text-sm text-red-700">Reason: {doc.rejection_reason}</p>
              ) : null}

              {doc ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => openDocument(doc.storage_path)}
                    className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--primary-light)] disabled:opacity-50"
                  >
                    View document
                  </button>
                  {doc.status !== "approved" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => review(doc.id, "approved")}
                      className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Approve document
                    </button>
                  ) : null}
                  {doc.status !== "rejected" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => setRejectingId(doc.id)}
                      className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary-dark)] disabled:opacity-50"
                    >
                      Reject
                    </button>
                  ) : null}
                </div>
              ) : null}

              {rejectingId === doc?.id ? (
                <div className="mt-4 space-y-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Rejection reason (optional)"
                    className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => review(doc.id, "rejected", rejectReason)}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      Confirm reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason("");
                      }}
                      className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[var(--muted)]">Business ID: {businessId}</p>
    </div>
  );
}
