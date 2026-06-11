import { UserRoleSelect } from "@/components/admin/UserRoleSelect";
import { createClient } from "@/lib/supabase/server";

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Users</h1>
      <p className="mt-2 text-[var(--muted)]">
        Manage customer, business owner, and admin roles.
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--surface)] text-[var(--primary-dark)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Phone</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
            </tr>
          </thead>
          <tbody>
            {(users ?? []).map((user) => (
              <tr key={user.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-medium">
                  {user.full_name || "—"}
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {user.phone || "—"}
                </td>
                <td className="px-4 py-3">
                  <UserRoleSelect userId={user.id} role={user.role} />
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {new Date(user.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!users?.length ? (
          <p className="p-8 text-center text-[var(--muted)]">No users yet.</p>
        ) : null}
      </div>
    </div>
  );
}
