"use client";

import { useTransition } from "react";

import { updateUserRole } from "@/app/actions/admin";
import type { UserRole } from "@/lib/types/database";

const roles: UserRole[] = ["customer", "business_owner", "admin"];

export function UserRoleSelect({
  userId,
  role,
}: {
  userId: string;
  role: UserRole;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      disabled={pending}
      value={role}
      onChange={(e) => {
        const value = e.target.value as UserRole;
        startTransition(async () => {
          await updateUserRole(userId, value);
        });
      }}
      className="rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-xs font-semibold text-[var(--primary-dark)] outline-none focus:border-[var(--primary)]"
    >
      {roles.map((r) => (
        <option key={r} value={r}>
          {r.replace("_", " ")}
        </option>
      ))}
    </select>
  );
}
