import Link from "next/link";

import type { UserRole } from "@/lib/types/database";

export type UserRoleFilter = "all" | UserRole;

const TABS: { id: UserRoleFilter; label: string }[] = [
  { id: "all", label: "All users" },
  { id: "customer", label: "Customers" },
  { id: "business_owner", label: "Business owners" },
  { id: "admin", label: "Admins" },
];

type UserRoleTabsProps = {
  active: UserRoleFilter;
  counts: Record<UserRoleFilter, number>;
};

export function UserRoleTabs({ active, counts }: UserRoleTabsProps) {
  return (
    <div className="mt-8 flex flex-wrap gap-2 border-b border-[var(--border)] pb-3">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const href = tab.id === "all" ? "/dashboard/users" : `/dashboard/users?role=${tab.id}`;
        const count = counts[tab.id] ?? 0;

        return (
          <Link
            key={tab.id}
            href={href}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              isActive
                ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                : "border-[var(--border)] bg-white text-[var(--primary-dark)] hover:border-[var(--primary)] hover:bg-[var(--primary-light)]"
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-[var(--surface)] text-[var(--muted)]"
              }`}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function parseUserRoleFilter(role?: string): UserRoleFilter {
  if (role === "customer" || role === "business_owner" || role === "admin") {
    return role;
  }
  return "all";
}

export function filterUsersByRole<T extends { role: UserRole }>(
  users: T[],
  filter: UserRoleFilter,
): T[] {
  if (filter === "all") return users;
  return users.filter((user) => user.role === filter);
}

export function countUsersByRole<T extends { role: UserRole }>(
  users: T[],
): Record<UserRoleFilter, number> {
  return {
    all: users.length,
    customer: users.filter((u) => u.role === "customer").length,
    business_owner: users.filter((u) => u.role === "business_owner").length,
    admin: users.filter((u) => u.role === "admin").length,
  };
}

export function emptyUsersMessage(filter: UserRoleFilter): string {
  switch (filter) {
    case "customer":
      return "No customers registered yet.";
    case "business_owner":
      return "No business owners registered yet.";
    case "admin":
      return "No admins registered yet.";
    default:
      return "No users yet.";
  }
}
