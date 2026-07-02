"use client";

import { useMemo, useState, useTransition } from "react";

import { DefaultCommissionSettings } from "@/components/admin/DefaultCommissionSettings";
import { ConfirmPanel } from "@/components/admin/ConfirmPanel";
import {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  setSubscriptionPlanVisibility,
  updateSubscriptionPlan,
} from "@/app/actions/admin";
import { slugifyCategoryName } from "@/lib/categories";
import {
  commissionRateToPercentInput,
  formatCommissionPercent,
  parseCommissionPercentInput,
} from "@/lib/commission";
import type { SubscriptionPlan } from "@/lib/types/database";

type PlanManagerProps = {
  plans: SubscriptionPlan[];
  defaultCommissionRate: number;
};

type FormState = {
  name: string;
  slug: string;
  description: string;
  monthly_fee_etb: string;
  yearly_fee_etb: string;
  max_services: string;
  max_bookings_per_week: string;
  commission_rate_percent: string;
  sort_order: string;
  is_featured_in_search: boolean;
};

const emptyForm = (): FormState => ({
  name: "",
  slug: "",
  description: "",
  monthly_fee_etb: "0",
  yearly_fee_etb: "0",
  max_services: "10",
  max_bookings_per_week: "50",
  commission_rate_percent: "10",
  sort_order: "",
  is_featured_in_search: false,
});

function toForm(plan: SubscriptionPlan): FormState {
  return {
    name: plan.name,
    slug: plan.slug,
    description: plan.description ?? "",
    monthly_fee_etb: String(plan.monthly_fee_etb),
    yearly_fee_etb: String(plan.yearly_fee_etb),
    max_services: String(plan.max_services),
    max_bookings_per_week: String(plan.max_bookings_per_week),
    commission_rate_percent: commissionRateToPercentInput(Number(plan.commission_rate)),
    sort_order: String(plan.sort_order),
    is_featured_in_search: plan.is_featured_in_search,
  };
}

function parseForm(form: FormState) {
  return {
    name: form.name.trim(),
    slug: form.slug.trim().toLowerCase(),
    description: form.description.trim() || null,
    monthly_fee_etb: Number(form.monthly_fee_etb) || 0,
    yearly_fee_etb: Number(form.yearly_fee_etb) || 0,
    max_services: Number(form.max_services) || 1,
    max_bookings_per_week: Number(form.max_bookings_per_week) || 1,
    commission_rate: parseCommissionPercentInput(form.commission_rate_percent),
    sort_order: form.sort_order.trim() ? Number(form.sort_order) : undefined,
    is_featured_in_search: form.is_featured_in_search,
  };
}

type ConfirmAction =
  | {
      type: "delete";
      planId: string;
      title: string;
      message: string;
    }
  | {
      type: "toggle-visibility";
      planId: string;
      hide: boolean;
      title: string;
      message: string;
    };

export function PlanManager({ plans, defaultCommissionRate }: PlanManagerProps) {
  const [addForm, setAddForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [pending, startTransition] = useTransition();

  const nextSortOrder = useMemo(() => {
    if (!plans.length) return 1;
    return Math.max(...plans.map((p) => p.sort_order)) + 1;
  }, [plans]);

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createSubscriptionPlan(parseForm(addForm));
        setAddForm(emptyForm());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create plan");
      }
    });
  };

  const submitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setError(null);
    startTransition(async () => {
      try {
        const parsed = parseForm(editForm);
        await updateSubscriptionPlan(editingId, {
          ...parsed,
          sort_order: parsed.sort_order ?? (Number(editForm.sort_order) || 0),
        });
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update plan");
      }
    });
  };

  const removePlan = (plan: SubscriptionPlan) => {
    setError(null);
    setConfirmAction({
      type: "delete",
      planId: plan.id,
      title: `Delete "${plan.name}"?`,
      message:
        "Businesses on this plan will fall back to the default commission rate. This cannot be undone.",
    });
  };

  const togglePlanVisibility = (plan: SubscriptionPlan) => {
    setError(null);
    const hide = plan.is_active;
    setConfirmAction({
      type: "toggle-visibility",
      planId: plan.id,
      hide,
      title: hide ? `Hide "${plan.name}"?` : `Show "${plan.name}" again?`,
      message: hide
        ? "The plan will be hidden from new business sign-ups but existing subscriptions stay unchanged."
        : "The plan will be available again for businesses to choose.",
    });
  };

  const runConfirmAction = () => {
    if (!confirmAction) return;

    setError(null);
    startTransition(async () => {
      try {
        if (confirmAction.type === "delete") {
          await deleteSubscriptionPlan(confirmAction.planId);
          if (editingId === confirmAction.planId) {
            setEditingId(null);
          }
        } else {
          await setSubscriptionPlanVisibility(confirmAction.planId, !confirmAction.hide);
        }
        setConfirmAction(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  };

  return (
    <div className="mt-8 space-y-8">
      <DefaultCommissionSettings defaultRate={defaultCommissionRate} />

      {confirmAction ? (
        <ConfirmPanel
          title={confirmAction.title}
          message={confirmAction.message}
          pending={pending}
          onConfirm={runConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      ) : null}

      <form onSubmit={submitAdd} className="rounded-2xl border border-[var(--border)] bg-white p-6 space-y-4">
        <h2 className="text-lg font-semibold text-[var(--primary-dark)]">Add plan</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Name</span>
            <input
              required
              value={addForm.name}
              onChange={(e) =>
                setAddForm((prev) => ({
                  ...prev,
                  name: e.target.value,
                  slug: prev.slug || slugifyCategoryName(e.target.value),
                }))
              }
              className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Slug</span>
            <input
              required
              value={addForm.slug}
              onChange={(e) => setAddForm((prev) => ({ ...prev, slug: e.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
            />
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-sm font-medium">Description</span>
            <input
              value={addForm.description}
              onChange={(e) => setAddForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Monthly fee (ETB)</span>
            <input
              type="number"
              min={0}
              value={addForm.monthly_fee_etb}
              onChange={(e) => setAddForm((prev) => ({ ...prev, monthly_fee_etb: e.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Yearly fee (ETB)</span>
            <input
              type="number"
              min={0}
              value={addForm.yearly_fee_etb}
              onChange={(e) => setAddForm((prev) => ({ ...prev, yearly_fee_etb: e.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Max services</span>
            <input
              type="number"
              min={1}
              value={addForm.max_services}
              onChange={(e) => setAddForm((prev) => ({ ...prev, max_services: e.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Max bookings / week</span>
            <input
              type="number"
              min={1}
              value={addForm.max_bookings_per_week}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, max_bookings_per_week: e.target.value }))
              }
              className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Platform commission (%)</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              required
              value={addForm.commission_rate_percent}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, commission_rate_percent: e.target.value }))
              }
              className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={addForm.is_featured_in_search}
            onChange={(e) =>
              setAddForm((prev) => ({ ...prev, is_featured_in_search: e.target.checked }))
            }
          />
          Featured in search (shown at top of results)
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          Add plan
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[var(--border)] bg-[var(--surface)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Fees (mo / yr)</th>
              <th className="px-4 py-3 font-semibold">Commission</th>
              <th className="px-4 py-3 font-semibold">Limits</th>
              <th className="px-4 py-3 font-semibold">Featured</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-b border-[var(--border)] last:border-0 align-top">
                {editingId === plan.id ? (
                  <td colSpan={7} className="px-4 py-4">
                    <form onSubmit={submitEdit} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block space-y-1">
                          <span className="text-sm font-medium">Name</span>
                          <input
                            required
                            value={editForm.name}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, name: e.target.value }))
                            }
                            className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-sm font-medium">Slug</span>
                          <input
                            required
                            value={editForm.slug}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, slug: e.target.value }))
                            }
                            className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
                          />
                        </label>
                        <label className="block space-y-1 sm:col-span-2">
                          <span className="text-sm font-medium">Description</span>
                          <input
                            value={editForm.description}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, description: e.target.value }))
                            }
                            className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-sm font-medium">Monthly (ETB)</span>
                          <input
                            type="number"
                            min={0}
                            value={editForm.monthly_fee_etb}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, monthly_fee_etb: e.target.value }))
                            }
                            className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-sm font-medium">Yearly (ETB)</span>
                          <input
                            type="number"
                            min={0}
                            value={editForm.yearly_fee_etb}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, yearly_fee_etb: e.target.value }))
                            }
                            className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-sm font-medium">Max services</span>
                          <input
                            type="number"
                            min={1}
                            value={editForm.max_services}
                            onChange={(e) =>
                              setEditForm((prev) => ({ ...prev, max_services: e.target.value }))
                            }
                            className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-sm font-medium">Max bookings / week</span>
                          <input
                            type="number"
                            min={1}
                            value={editForm.max_bookings_per_week}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                max_bookings_per_week: e.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-sm font-medium">Platform commission (%)</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={0.1}
                            required
                            value={editForm.commission_rate_percent}
                            onChange={(e) =>
                              setEditForm((prev) => ({
                                ...prev,
                                commission_rate_percent: e.target.value,
                              }))
                            }
                            className="w-full rounded-xl border border-[var(--border)] px-4 py-2.5"
                          />
                        </label>
                      </div>
                      <label className="flex items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={editForm.is_featured_in_search}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              is_featured_in_search: e.target.checked,
                            }))
                          }
                        />
                        Featured in search (shown at top of results)
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          disabled={pending}
                          className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3">
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-xs text-[var(--muted)]">{plan.slug}</p>
                      {plan.description ? (
                        <p className="mt-1 text-xs text-[var(--muted)]">{plan.description}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      {Number(plan.monthly_fee_etb).toLocaleString()} /{" "}
                      {Number(plan.yearly_fee_etb).toLocaleString()} ETB
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--primary-dark)]">
                      {formatCommissionPercent(Number(plan.commission_rate))}
                    </td>
                    <td className="px-4 py-3">
                      {plan.max_services} services · {plan.max_bookings_per_week} bookings/wk
                    </td>
                    <td className="px-4 py-3">
                      {plan.is_featured_in_search ? (
                        <span className="text-green-700">Yes</span>
                      ) : (
                        <span className="text-[var(--muted)]">No</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {plan.is_active ? (
                        <span className="text-green-700">Active</span>
                      ) : (
                        <span className="text-[var(--muted)]">Hidden</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(plan.id);
                            setEditForm(toForm(plan));
                          }}
                          className="text-sm font-semibold text-[var(--primary)] hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => togglePlanVisibility(plan)}
                          className="text-sm font-semibold text-[var(--primary-dark)] hover:underline"
                        >
                          {plan.is_active ? "Hide" : "Show"}
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => removePlan(plan)}
                          className="text-sm font-semibold text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
    </div>
  );
}
