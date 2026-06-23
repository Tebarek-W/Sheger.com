"use server";

import { revalidatePath } from "next/cache";

import { getSessionProfile } from "@/lib/auth";
import { slugifyCategoryName } from "@/lib/categories";
import { summarizeDocumentApproval } from "@/lib/documents/approval";
import { getRequiredDocumentTypes } from "@/lib/documents/license";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  BusinessDocument,
  BusinessDocumentStatus,
} from "@/lib/types/database";

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

async function assertBusinessCanBeApproved(businessId: string) {
  const supabase = createAdminClient();
  const { data: business, error } = await supabase
    .from("businesses")
    .select("id, categories(slug), business_documents(document_type, status)")
    .eq("id", businessId)
    .single();

  if (error || !business) {
    throw new Error("Business not found");
  }

  const categorySlug = (business.categories as { slug: string } | null)?.slug ?? null;
  const documents =
    (business.business_documents as Pick<BusinessDocument, "document_type" | "status">[] | null) ??
    [];
  const summary = summarizeDocumentApproval(categorySlug, documents);

  if (!summary.allUploaded) {
    throw new Error("Cannot approve: required license documents are missing.");
  }
  if (!summary.allApproved) {
    throw new Error("Cannot approve: all required license documents must be verified first.");
  }
}

export async function updateBusinessStatus(
  businessId: string,
  status: "approved" | "rejected" | "suspended" | "pending",
) {
  await requireAdmin();
  if (status === "approved") {
    await assertBusinessCanBeApproved(businessId);
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("businesses")
    .update({ status })
    .eq("id", businessId);

  if (error) throw error;
  revalidatePath("/dashboard/businesses");
  revalidatePath(`/dashboard/businesses/${businessId}`);
  revalidatePath("/dashboard");
}

export async function getBusinessLicenseSignedUrl(storagePath: string) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from("business-licenses")
    .createSignedUrl(storagePath, 60 * 15);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Could not generate document link");
  return data.signedUrl;
}

export async function reviewBusinessDocument(
  documentId: string,
  status: Extract<BusinessDocumentStatus, "approved" | "rejected">,
  rejectionReason?: string,
) {
  await requireAdmin();
  const { profile } = await getSessionProfile();
  if (!profile) throw new Error("Admin session required");

  const supabase = createAdminClient();
  const { data: doc, error: fetchError } = await supabase
    .from("business_documents")
    .select("id, business_id")
    .eq("id", documentId)
    .single();

  if (fetchError || !doc) throw new Error("Document not found");

  const { error } = await supabase
    .from("business_documents")
    .update({
      status,
      rejection_reason: status === "rejected" ? rejectionReason?.trim() || "Rejected by admin" : null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) throw error;

  revalidatePath("/dashboard/businesses");
  revalidatePath(`/dashboard/businesses/${doc.business_id}`);
}

export async function getBusinessDocumentRequirements(categorySlug: string | null) {
  return getRequiredDocumentTypes(categorySlug);
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

export type SubscriptionPlanInput = {
  name: string;
  slug: string;
  description?: string | null;
  monthly_fee_etb: number;
  yearly_fee_etb: number;
  max_services: number;
  max_bookings_per_week: number;
  sort_order?: number;
  is_featured_in_search?: boolean;
};

function revalidatePlans() {
  revalidatePath("/dashboard/plans");
}

export async function createSubscriptionPlan(input: SubscriptionPlanInput) {
  await requireAdmin();
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  if (!name) throw new Error("Plan name is required");
  if (!slug) throw new Error("Plan slug is required");
  if (input.max_services < 1 || input.max_bookings_per_week < 1) {
    throw new Error("Limits must be at least 1");
  }
  if (input.monthly_fee_etb < 0 || input.yearly_fee_etb < 0) {
    throw new Error("Fees must be >= 0");
  }

  const supabase = createAdminClient();
  let sortOrder = input.sort_order;
  if (sortOrder == null) {
    const { data: last } = await supabase
      .from("subscription_plans")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    sortOrder = (last?.sort_order ?? 0) + 1;
  }

  const { error } = await supabase.from("subscription_plans").insert({
    name,
    slug,
    description: input.description?.trim() || null,
    monthly_fee_etb: input.monthly_fee_etb,
    yearly_fee_etb: input.yearly_fee_etb,
    max_services: input.max_services,
    max_bookings_per_week: input.max_bookings_per_week,
    sort_order: sortOrder,
    is_active: true,
    is_featured_in_search: input.is_featured_in_search ?? false,
  });

  if (error) {
    if (error.code === "23505") throw new Error("A plan with this slug already exists");
    throw error;
  }
  revalidatePlans();
}

export async function updateSubscriptionPlan(planId: string, input: SubscriptionPlanInput) {
  await requireAdmin();
  const name = input.name.trim();
  const slug = input.slug.trim().toLowerCase();
  if (!name) throw new Error("Plan name is required");
  if (!slug) throw new Error("Plan slug is required");
  if (input.max_services < 1 || input.max_bookings_per_week < 1) {
    throw new Error("Limits must be at least 1");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("subscription_plans")
    .update({
      name,
      slug,
      description: input.description?.trim() || null,
      monthly_fee_etb: input.monthly_fee_etb,
      yearly_fee_etb: input.yearly_fee_etb,
      max_services: input.max_services,
      max_bookings_per_week: input.max_bookings_per_week,
      sort_order: input.sort_order ?? 0,
      is_featured_in_search: input.is_featured_in_search ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);

  if (error) {
    if (error.code === "23505") throw new Error("A plan with this slug already exists");
    throw error;
  }
  revalidatePlans();
}

export async function setSubscriptionPlanVisibility(planId: string, isActive: boolean) {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("subscription_plans")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) throw error;
  revalidatePlans();
}

export async function deleteSubscriptionPlan(planId: string) {
  await requireAdmin();
  const supabase = createAdminClient();

  const { count, error: countError } = await supabase
    .from("business_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", planId);

  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    throw new Error("Cannot delete a plan that businesses are currently using. Hide it instead.");
  }

  const { error } = await supabase.from("subscription_plans").delete().eq("id", planId);
  if (error) throw error;
  revalidatePlans();
}
