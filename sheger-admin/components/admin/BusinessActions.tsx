"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { updateBusinessStatus } from "@/app/actions/admin";
import { ConfirmPanel } from "@/components/admin/ConfirmPanel";
import type { BusinessStatus } from "@/lib/types/database";

type ConfirmAction = {
  status: BusinessStatus;
  title: string;
  message: string;
};

const CONFIRM_MESSAGES: Partial<
  Record<BusinessStatus, { title: string; message: string }>
> = {
  approved: {
    title: "Approve this business?",
    message: "The business will become visible to customers and can accept bookings.",
  },
  rejected: {
    title: "Reject this business?",
    message: "The owner will not be able to operate on Sheger until they reapply or you approve later.",
  },
  suspended: {
    title: "Suspend this business?",
    message: "The business will be hidden from customers and cannot accept new bookings.",
  },
};

export function BusinessActions({
  businessId,
  status,
  canApprove = true,
  approveHint,
  reviewHref,
}: {
  businessId: string;
  status: BusinessStatus;
  canApprove?: boolean;
  approveHint?: string;
  reviewHref?: string;
}) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [pending, startTransition] = useTransition();

  const requestAction = (next: BusinessStatus) => {
    const copy = CONFIRM_MESSAGES[next];
    if (!copy) return;
    setConfirmAction({ status: next, ...copy });
  };

  const runConfirmAction = () => {
    if (!confirmAction) return;
    startTransition(async () => {
      await updateBusinessStatus(businessId, confirmAction.status);
      setConfirmAction(null);
    });
  };

  return (
    <div className="flex flex-col gap-2">
      {confirmAction ? (
        <ConfirmPanel
          title={confirmAction.title}
          message={confirmAction.message}
          pending={pending}
          onConfirm={runConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {reviewHref ? (
          <Link
            href={reviewHref}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--primary-light)]"
          >
            Review
          </Link>
        ) : null}
        {status !== "approved" ? (
          <button
            type="button"
            disabled={pending || !canApprove}
            title={!canApprove ? approveHint : undefined}
            onClick={() => requestAction("approved")}
            className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Approve
          </button>
        ) : null}
        {status !== "rejected" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => requestAction("rejected")}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--primary-light)] disabled:opacity-50"
          >
            Reject
          </button>
        ) : null}
        {status !== "suspended" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => requestAction("suspended")}
            className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--primary-light)] disabled:opacity-50"
          >
            Suspend
          </button>
        ) : null}
      </div>
      {!canApprove && approveHint ? (
        <p className="text-xs text-amber-800">{approveHint}</p>
      ) : null}
    </div>
  );
}
