const styles: Record<string, string> = {
  pending: "bg-white text-[var(--primary-dark)] border-[var(--border)]",
  approved: "bg-[var(--primary)] text-white border-[var(--primary)]",
  confirmed: "bg-[var(--primary)] text-white border-[var(--primary)]",
  rejected: "bg-white text-[var(--primary-dark)] border-[var(--border)]",
  suspended: "bg-white text-[var(--primary-dark)] border-[var(--border)]",
  cancelled: "bg-white text-[var(--muted)] border-[var(--border)]",
  completed: "bg-[var(--primary-light)] text-[var(--primary-dark)] border-[var(--border)]",
  paid: "bg-[var(--primary)] text-white border-[var(--primary)]",
  awaiting_payment: "bg-white text-[var(--primary-dark)] border-[var(--border)]",
  failed: "bg-white text-[var(--muted)] border-[var(--border)]",
  refunded: "bg-white text-[var(--muted)] border-[var(--border)]",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
        styles[status] ?? styles.pending
      }`}
    >
      {status}
    </span>
  );
}
