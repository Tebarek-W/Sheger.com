"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/users", label: "Users" },
  { href: "/dashboard/businesses", label: "Businesses" },
  { href: "/dashboard/categories", label: "Categories" },
  { href: "/dashboard/bookings", label: "Bookings" },
  { href: "/dashboard/payments", label: "Booking payments" },
  { href: "/dashboard/plans", label: "Subscription plans" },
  { href: "/dashboard/reports", label: "Reports" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const signOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-10">
        <p className="text-2xl font-extrabold text-[var(--primary-dark)]">Sheger</p>
        <p className="text-sm text-[var(--muted)]">Admin Panel</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const active =
            pathname === link.href ||
            (link.href !== "/dashboard" && pathname.startsWith(link.href));
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--primary-dark)] hover:bg-[var(--primary-light)]"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={signOut}
        className="mt-6 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-left text-sm font-semibold text-[var(--primary-dark)] hover:bg-[var(--primary-light)]"
      >
        Sign out
      </button>
    </aside>
  );
}
