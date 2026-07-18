"use client";

import { useState, useTransition } from "react";

import { resolveReviewReport } from "@/app/actions/admin";
import { ConfirmPanel } from "@/components/admin/ConfirmPanel";

export function ReviewReportActions({
  reportId,
  reviewId,
  reviewHidden,
}: {
  reportId: string;
  reviewId: string;
  reviewHidden: boolean;
}) {
  const [mode, setMode] = useState<"hide" | "dismiss" | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: "hide" | "dismiss") => {
    setError(null);
    startTransition(async () => {
      try {
        await resolveReviewReport(reportId, reviewId, action);
        setMode(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update report");
      }
    });
  };

  if (mode) {
    return (
      <ConfirmPanel
        title={mode === "hide" ? "Hide this review?" : "Dismiss report?"}
        message={
          mode === "hide"
            ? "The review will be hidden from customers and this report marked actioned."
            : "Keep the review visible and mark this report as dismissed."
        }
        pending={pending}
        onConfirm={() => run(mode)}
        onCancel={() => {
          setMode(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {!reviewHidden ? (
          <button
            type="button"
            onClick={() => setMode("hide")}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--primary-light)]"
          >
            Hide review
          </button>
        ) : (
          <span className="text-xs text-[var(--muted)]">Already hidden</span>
        )}
        <button
          type="button"
          onClick={() => setMode("dismiss")}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface)]"
        >
          Dismiss
        </button>
      </div>
      {error ? <p className="max-w-[220px] text-right text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
