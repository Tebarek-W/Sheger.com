"use client";

import { useTransition } from "react";

import { updateBusinessStatus } from "@/app/actions/admin";
import type { BusinessStatus } from "@/lib/types/database";

export function BusinessActions({
  businessId,
  status,
}: {
  businessId: string;
  status: BusinessStatus;
}) {
  const [pending, startTransition] = useTransition();

  const act = (next: BusinessStatus) => {
    startTransition(async () => {
      await updateBusinessStatus(businessId, next);
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "approved" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => act("approved")}
          className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--primary-dark)] disabled:opacity-50"
        >
          Approve
        </button>
      ) : null}
      {status !== "rejected" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => act("rejected")}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--primary-light)] disabled:opacity-50"
        >
          Reject
        </button>
      ) : null}
      {status !== "suspended" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => act("suspended")}
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--primary-light)] disabled:opacity-50"
        >
          Suspend
        </button>
      ) : null}
    </div>
  );
}
