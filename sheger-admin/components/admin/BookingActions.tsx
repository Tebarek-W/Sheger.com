"use client";

import { useTransition } from "react";

import { updateBookingStatus } from "@/app/actions/admin";
import type { BookingStatus } from "@/lib/types/database";

const nextStatuses: BookingStatus[] = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
];

export function BookingActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      disabled={pending}
      value={status}
      onChange={(e) => {
        const value = e.target.value as BookingStatus;
        startTransition(async () => {
          await updateBookingStatus(bookingId, value);
        });
      }}
      className="rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-xs font-semibold text-[var(--primary-dark)] outline-none focus:border-[var(--primary)]"
    >
      {nextStatuses.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
