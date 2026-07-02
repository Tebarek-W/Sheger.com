"use client";

import { useMemo, useState, useTransition } from "react";

import {
  createCategory,
  deleteCategory,
  setCategoryVisibility,
  updateCategory,
} from "@/app/actions/admin";
import { ConfirmPanel } from "@/components/admin/ConfirmPanel";
import { slugifyCategoryName } from "@/lib/categories";
import type { Category } from "@/lib/types/database";

type CategoryManagerProps = {
  categories: Category[];
  visibilitySupported?: boolean;
};

type FormState = {
  name: string;
  slug: string;
  icon: string;
  sort_order: string;
};

type ConfirmAction =
  | {
      type: "delete";
      categoryId: string;
      title: string;
      message: string;
    }
  | {
      type: "toggle-visibility";
      categoryId: string;
      title: string;
      message: string;
    };

const emptyForm = (): FormState => ({
  name: "",
  slug: "",
  icon: "",
  sort_order: "",
});

function isCategoryVisible(category: Category): boolean {
  return category.is_active !== false;
}

function toForm(category: Category): FormState {
  return {
    name: category.name,
    slug: category.slug,
    icon: category.icon ?? "",
    sort_order: String(category.sort_order),
  };
}

export function CategoryManager({
  categories,
  visibilitySupported = true,
}: CategoryManagerProps) {
  const [addForm, setAddForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [pending, startTransition] = useTransition();

  const nextSortOrder = useMemo(() => {
    if (!categories.length) return 1;
    return Math.max(...categories.map((c) => c.sort_order)) + 1;
  }, [categories]);

  const onAddNameChange = (name: string) => {
    setAddForm((prev) => ({
      ...prev,
      name,
      slug: prev.slug || slugifyCategoryName(name),
    }));
  };

  const onEditNameChange = (name: string) => {
    setEditForm((prev) => ({ ...prev, name }));
  };

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createCategory({
          name: addForm.name,
          slug: addForm.slug,
          icon: addForm.icon || null,
          sort_order: addForm.sort_order
            ? Number(addForm.sort_order)
            : nextSortOrder,
        });
        setAddForm(emptyForm());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not add category");
      }
    });
  };

  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditForm(toForm(category));
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm());
    setError(null);
  };

  const submitEdit = (categoryId: string) => {
    setError(null);
    const sortOrder = Number(editForm.sort_order);
    if (!Number.isInteger(sortOrder)) {
      setError("Sort order must be a whole number");
      return;
    }

    startTransition(async () => {
      try {
        await updateCategory(categoryId, {
          name: editForm.name,
          slug: editForm.slug,
          icon: editForm.icon || null,
          sort_order: sortOrder,
        });
        cancelEdit();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update category");
      }
    });
  };

  const remove = (category: Category) => {
    setError(null);
    setConfirmAction({
      type: "delete",
      categoryId: category.id,
      title: `Delete "${category.name}"?`,
      message:
        "Businesses in this category will have their category cleared.",
    });
  };

  const toggleVisibility = (category: Category) => {
    const hide = isCategoryVisible(category);
    setError(null);
    setConfirmAction({
      type: "toggle-visibility",
      categoryId: category.id,
      title: hide
        ? `Mark "${category.name}" as inactive?`
        : `Mark "${category.name}" as active again?`,
      message: hide
        ? "The category will be kept but won't appear for customers or new business registrations."
        : "The category will be available again for customers and new business registrations.",
    });
  };

  const runConfirmAction = () => {
    if (!confirmAction) return;

    setError(null);
    startTransition(async () => {
      try {
        if (confirmAction.type === "delete") {
          await deleteCategory(confirmAction.categoryId);
          if (editingId === confirmAction.categoryId) cancelEdit();
        } else {
          const category = categories.find((item) => item.id === confirmAction.categoryId);
          if (!category) {
            throw new Error("Category not found");
          }
          await setCategoryVisibility(
            confirmAction.categoryId,
            !isCategoryVisible(category),
          );
        }
        setConfirmAction(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : confirmAction.type === "delete"
              ? "Could not delete category"
              : "Could not update visibility",
        );
      }
    });
  };

  return (
    <div className="mt-8 space-y-6">
      <form
        onSubmit={submitAdd}
        className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <h2 className="text-lg font-semibold text-[var(--primary-dark)]">
          Add category
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          New categories appear in the mobile app for business registration and
          discovery.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Name" required>
            <input
              value={addForm.name}
              onChange={(e) => onAddNameChange(e.target.value)}
              placeholder="e.g. Pet Grooming"
              className={inputClass}
              required
            />
          </Field>
          <Field label="Slug" required>
            <input
              value={addForm.slug}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, slug: e.target.value }))
              }
              placeholder="pet-grooming"
              className={inputClass}
              required
            />
          </Field>
          <Field label="Icon key">
            <input
              value={addForm.icon}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, icon: e.target.value }))
              }
              placeholder="e.g. scissors"
              className={inputClass}
            />
          </Field>
          <Field label="Sort order">
            <input
              value={addForm.sort_order}
              onChange={(e) =>
                setAddForm((prev) => ({ ...prev, sort_order: e.target.value }))
              }
              placeholder={String(nextSortOrder)}
              inputMode="numeric"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-dark)] disabled:opacity-50"
          >
            Add category
          </button>
          <span className="text-xs text-[var(--muted)]">
            Slug is used in URLs and the mobile app.
          </span>
        </div>
      </form>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {confirmAction ? (
        <ConfirmPanel
          title={confirmAction.title}
          message={confirmAction.message}
          pending={pending}
          onConfirm={runConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface)] text-[var(--primary-dark)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Slug</th>
              <th className="px-4 py-3 font-semibold">Icon</th>
              {visibilitySupported ? (
                <th className="px-4 py-3 font-semibold">Active / Inactive</th>
              ) : null}
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const isEditing = editingId === category.id;

              if (isEditing) {
                return (
                  <tr key={category.id} className="border-t border-[var(--border)] bg-[var(--surface)]">
                    <td className="px-4 py-3">
                      <input
                        value={editForm.sort_order}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            sort_order: e.target.value,
                          }))
                        }
                        inputMode="numeric"
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={editForm.name}
                        onChange={(e) => onEditNameChange(e.target.value)}
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={editForm.slug}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, slug: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        value={editForm.icon}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, icon: e.target.value }))
                        }
                        className={inputClass}
                      />
                    </td>
                    {visibilitySupported ? (
                      <td className="px-4 py-3">
                        <ActiveStatusBadge isActive={isCategoryVisible(category)} />
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => submitEdit(category.id)}
                          className="rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--primary-dark)] disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={cancelEdit}
                          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--primary-light)] disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr
                  key={category.id}
                  className={`border-t border-[var(--border)] ${
                    visibilitySupported && !isCategoryVisible(category)
                      ? "bg-[var(--surface)] opacity-70"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 text-[var(--muted)]">{category.sort_order}</td>
                  <td className="px-4 py-3 font-medium text-[var(--primary-dark)]">
                    {category.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                    {category.slug}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {category.icon || "—"}
                  </td>
                  {visibilitySupported ? (
                    <td className="px-4 py-3">
                      <ActiveStatusBadge isActive={isCategoryVisible(category)} />
                    </td>
                  ) : null}
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {visibilitySupported ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggleVisibility(category)}
                          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--primary-light)] disabled:opacity-50"
                        >
                          {isCategoryVisible(category) ? "Deactivate" : "Activate"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => startEdit(category)}
                        className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary-dark)] hover:bg-[var(--primary-light)] disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => remove(category)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!categories.length ? (
          <p className="p-8 text-center text-[var(--muted)]">
            No categories yet. Add your first category above.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--primary-dark)] outline-none focus:border-[var(--primary)]";

function ActiveStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        isActive
          ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary-dark)]"
          : "border-[var(--border)] bg-white text-[var(--muted)]"
      }`}
    >
      {isActive ? "Active" : "Inactive"}
    </span>
  );
}
