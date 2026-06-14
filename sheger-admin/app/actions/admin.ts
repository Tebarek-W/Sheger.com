"use server";

import { revalidatePath } from "next/cache";

import { getSessionProfile } from "@/lib/auth";
import { slugifyCategoryName } from "@/lib/categories";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Server Actions run as POST endpoints and use the service-role client, which
 * bypasses RLS. Authorization must therefore be enforced here in every action
 * rather than relying on middleware alone.
 */
async function requireAdmin() {
  const { isAdmin } = await getSessionProfile();
  if (!isAdmin) {
    throw new Error("Forbidden: admin access required");
  }
}

export async function updateBusinessStatus(
  businessId: string,
  status: "approved" | "rejected" | "suspended" | "pending",
) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("businesses")
    .update({ status })
    .eq("id", businessId);

  if (error) throw error;
  revalidatePath("/dashboard/businesses");
  revalidatePath("/dashboard");
}

export type CategoryInput = {
  name: string;
  slug?: string;
  icon?: string | null;
  sort_order?: number;
};

function revalidateCategories() {
  revalidatePath("/dashboard/categories");
  revalidatePath("/dashboard");
}

function throwAdminActionError(error: unknown, context: string): never {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: string }).message)
      : error instanceof Error
        ? error.message
        : String(error);

  if (raw.includes("is_active") && raw.includes("schema cache")) {
    throw new Error(
      `${context} requires the category visibility migration. Run supabase/migrations/20250613000010_category_visibility.sql in the Supabase SQL Editor, then reload this page.`,
    );
  }

  throw error instanceof Error ? error : new Error(raw);
}

export async function createCategory(input: CategoryInput) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required");

  const slug = (input.slug?.trim() || slugifyCategoryName(name)).toLowerCase();
  if (!slug) throw new Error("A valid slug is required");

  const supabase = createAdminClient();

  let sortOrder = input.sort_order;
  if (sortOrder == null) {
    const { data: last } = await supabase
      .from("categories")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (last?.sort_order ?? 0) + 1;
  }

  const { error } = await supabase.from("categories").insert({
    name,
    slug,
    icon: input.icon?.trim() || null,
    sort_order: sortOrder,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("A category with this slug already exists");
    }
    throw error;
  }

  revalidateCategories();
}

export async function updateCategory(
  categoryId: string,
  input: CategoryInput & { sort_order: number },
) {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) throw new Error("Category name is required");

  const slug = (input.slug?.trim() || slugifyCategoryName(name)).toLowerCase();
  if (!slug) throw new Error("A valid slug is required");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("categories")
    .update({
      name,
      slug,
      icon: input.icon?.trim() || null,
      sort_order: input.sort_order,
    })
    .eq("id", categoryId);

  if (error) {
    if (error.code === "23505") {
      throw new Error("A category with this slug already exists");
    }
    throw error;
  }

  revalidateCategories();
}

export async function deleteCategory(categoryId: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);

  if (error) throw error;
  revalidateCategories();
}

export async function setCategoryVisibility(categoryId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", categoryId);

  if (error) throwAdminActionError(error, "Hide/show category");
  revalidateCategories();
}
