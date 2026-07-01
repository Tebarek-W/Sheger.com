"use client";

import { useState, useTransition } from "react";

import { updateDefaultBookingCommissionRate } from "@/app/actions/admin";
import {
  commissionRateToPercentInput,
  formatCommissionPercent,
  parseCommissionPercentInput,
} from "@/lib/commission";

type DefaultCommissionSettingsProps = {
  defaultRate: number;
};

export function DefaultCommissionSettings({ defaultRate }: DefaultCommissionSettingsProps) {
  const [percent, setPercent] = useState(commissionRateToPercentInput(defaultRate));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const rate = parseCommissionPercentInput(percent);
        await updateDefaultBookingCommissionRate(rate);
        setMessage(`Default commission updated to ${formatCommissionPercent(rate)}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update default commission");
      }
    });
  };

  return (
    <form
      onSubmit={onSave}
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-3"
    >
      <div>
        <h2 className="text-lg font-semibold text-[var(--primary-dark)]">
          Default booking commission
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Used when a business has no active subscription plan. Plan-specific rates below override
          this for subscribed businesses.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Platform commission (%)</span>
          <input
            type="number"
            min={0}
            max={100}
            step={0.1}
            required
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="w-32 rounded-xl border border-[var(--border)] px-4 py-2.5"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Save default
        </button>
        <p className="text-sm text-[var(--muted)]">
          Current: <strong>{formatCommissionPercent(defaultRate)}</strong>
        </p>
      </div>
      {message ? (
        <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </form>
  );
}
