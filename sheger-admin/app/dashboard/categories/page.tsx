import { CategoryManager } from "@/components/admin/CategoryManager";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/lib/types/database";

export default async function CategoriesPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });

  const rows = (categories ?? []) as Category[];
  const visibilitySupported =
    rows.length === 0 || Object.prototype.hasOwnProperty.call(rows[0], "is_active");

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Categories</h1>
      <p className="mt-2 text-[var(--muted)]">
        Manage service categories shown in the mobile app for discovery and business
        registration.
      </p>

      {!visibilitySupported ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Active/inactive status is unavailable until you run{" "}
          <code className="font-mono text-xs">
            20250613000010_category_visibility.sql
          </code>{" "}
          in the Supabase SQL Editor.
        </p>
      ) : null}

      <CategoryManager
        categories={rows}
        visibilitySupported={visibilitySupported}
      />
    </div>
  );
}
