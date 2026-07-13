"use client";

import { useState, useTransition } from "react";

import { updateUserBlocked } from "@/app/actions/admin";
import { ConfirmPanel } from "@/components/admin/ConfirmPanel";
import type { UserRole } from "@/lib/types/database";

export function UserActions({
  userId,
  role,
  isBlocked,
}: {
  userId: string;
  role: UserRole;
  isBlocked: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (role === "admin") {
    return <span className="text-xs text-[var(--muted)]">—</span>;
  }

  const nextBlocked = !isBlocked;

  const run = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updateUserBlocked(userId, nextBlocked);
        setConfirming(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update user");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {confirming ? (
        <ConfirmPanel
          title={nextBlocked ? "Block this user?" : "Unblock this user?"}
          message={
            nextBlocked
              ? "They will be signed out of the mobile app and cannot book or manage a business until you unblock them."
              : "They will be able to sign in and use Sheger again."
          }
          pending={pending}
          onConfirm={run}
          onCancel={() => {
            setConfirming(false);
            setError(null);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={
            nextBlocked
              ? "rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--primary-light)]"
              : "rounded-lg border border-[var(--primary)] bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          }
        >
          {nextBlocked ? "Block" : "Unblock"}
        </button>
      )}
      {error ? <p className="max-w-[220px] text-right text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
