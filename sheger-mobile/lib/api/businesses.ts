import { supabase } from "@/lib/supabase";
import type { Business, Category, Employee, Service } from "@/lib/types/database";

export type BusinessWithDetails = Business & {
  categories: Pick<Category, "name" | "slug"> | null;
  services: Service[];
};

export async function fetchApprovedBusinessesWithDetails() {
  const { data, error } = await supabase
    .from("businesses")
    .select("*, categories(name, slug), services(*)")
    .eq("status", "approved")
    .order("name");

  if (error) throw error;

  return (data ?? []).map((row) => ({
    ...row,
    services: ((row.services as Service[]) ?? []).filter((s) => s.is_active),
  })) as BusinessWithDetails[];
}

export async function fetchBusinessesByCategory(categoryId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("*, categories(name, slug)")
    .eq("category_id", categoryId)
    .eq("status", "approved")
    .order("name");

  if (error) throw error;
  return data as (Business & { categories: Pick<Category, "name" | "slug"> | null })[];
}

export async function fetchBusinessById(id: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("*, categories(name, slug)")
    .eq("id", id)
    .eq("status", "approved")
    .maybeSingle();

  if (error) throw error;
  return data as (Business & { categories: Pick<Category, "name" | "slug"> | null }) | null;
}

export async function fetchBusinessServices(businessId: string) {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("price");

  if (error) throw error;
  return data as Service[];
}

export async function fetchBusinessEmployees(businessId: string) {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("full_name");

  if (error) throw error;
  return data as Employee[];
}

export async function fetchCategoryBySlug(slug: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return data as Category | null;
}
