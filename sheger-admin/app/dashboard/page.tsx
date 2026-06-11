import { createClient } from "@/lib/supabase/server";

async function getStats() {
  const supabase = await createClient();

  const [users, businesses, pendingBusinesses, bookings, categories] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("businesses").select("*", { count: "exact", head: true }),
      supabase
        .from("businesses")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending"),
      supabase.from("bookings").select("*", { count: "exact", head: true }),
      supabase.from("categories").select("*", { count: "exact", head: true }),
    ]);

  return {
    users: users.count ?? 0,
    businesses: businesses.count ?? 0,
    pendingBusinesses: pendingBusinesses.count ?? 0,
    bookings: bookings.count ?? 0,
    categories: categories.count ?? 0,
  };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const cards = [
    { label: "Users", value: stats.users },
    { label: "Businesses", value: stats.businesses },
    { label: "Pending approval", value: stats.pendingBusinesses },
    { label: "Bookings", value: stats.bookings },
    { label: "Categories", value: stats.categories },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Dashboard</h1>
      <p className="mt-2 text-[var(--muted)]">
        Overview of the Sheger booking platform.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6"
          >
            <p className="text-sm font-semibold text-[var(--muted)]">{card.label}</p>
            <p className="mt-2 text-4xl font-extrabold text-[var(--primary-dark)]">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
