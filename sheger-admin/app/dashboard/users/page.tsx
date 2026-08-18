import { QueryError } from "@/components/admin/QueryError";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { UserActions } from "@/components/admin/UserActions";
import { UserRoleBadge } from "@/components/admin/UserRoleBadge";
import {
  countUsersByRole,
  emptyUsersMessage,
  filterUsersByRole,
  parseUserRoleFilter,
  UserRoleTabs,
} from "@/components/admin/UserRoleTabs";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types/database";

type UsersPageProps = {
  searchParams: Promise<{ role?: string }>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const { role: roleParam } = await searchParams;
  const activeFilter = parseUserRoleFilter(roleParam);

  const supabase = await createClient();
  const { data: users, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <QueryError title="Users" />;
  }

  const allUsers = users ?? [];
  const counts = countUsersByRole(allUsers);
  const filteredUsers = filterUsersByRole(allUsers, activeFilter);
  const blockedCount = allUsers.filter((u) => u.is_blocked).length;

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Users</h1>
      <p className="mt-2 text-[var(--muted)]">
        Registered customers, business owners, and admins.
        {blockedCount > 0 ? ` ${blockedCount} blocked.` : ""}
      </p>

      <UserRoleTabs active={activeFilter} counts={counts} />

      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface)] text-[var(--primary-dark)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-medium">
                  {user.full_name || "—"}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {user.phone || "—"}
                </td>
                <td className="px-4 py-3">
                  <UserRoleBadge role={user.role as UserRole} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={user.is_blocked ? "blocked" : "active"} />
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <UserActions
                      userId={user.id}
                      role={user.role as UserRole}
                      isBlocked={Boolean(user.is_blocked)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredUsers.length ? (
          <p className="p-8 text-center text-[var(--muted)]">
            {emptyUsersMessage(activeFilter)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
