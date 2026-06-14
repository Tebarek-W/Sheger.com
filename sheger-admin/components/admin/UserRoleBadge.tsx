import type { UserRole } from "@/lib/types/database";

const ROLE_LABELS: Record<UserRole, string> = {
  customer: "Customer",
  business_owner: "Business owner",
  admin: "Admin",
};

const ROLE_STYLES: Record<UserRole, string> = {
  customer: "bg-[var(--primary-light)] text-[var(--primary-dark)] border-[var(--border)]",
  business_owner: "bg-white text-[var(--primary-dark)] border-[var(--primary)]",
  admin: "bg-[var(--primary)] text-white border-[var(--primary)]",
};

export function UserRoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        ROLE_STYLES[role] ?? ROLE_STYLES.customer
      }`}
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}
