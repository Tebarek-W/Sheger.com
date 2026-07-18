import Link from "next/link";

import { SUPPORT_EMAIL } from "@/lib/legal/documents";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-full bg-[#f6f8f5] text-[var(--primary-dark)]">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/legal" className="text-xl font-extrabold text-[var(--primary-dark)]">
            Sheger
          </Link>
          <nav className="flex flex-wrap gap-3 text-sm font-medium text-[var(--muted)]">
            <Link href="/legal/privacy" className="hover:text-[var(--primary)]">
              Privacy
            </Link>
            <Link href="/legal/terms" className="hover:text-[var(--primary)]">
              Terms
            </Link>
            <Link href="/legal/business" className="hover:text-[var(--primary)]">
              Business
            </Link>
            <Link href="/legal/cancellation" className="hover:text-[var(--primary)]">
              Cancellation
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
      <footer className="border-t border-[var(--border)] bg-white">
        <div className="mx-auto max-w-3xl px-6 py-6 text-sm text-[var(--muted)]">
          Questions?{" "}
          <a className="font-semibold text-[var(--primary)]" href={`mailto:${SUPPORT_EMAIL}`}>
            {SUPPORT_EMAIL}
          </a>
        </div>
      </footer>
    </div>
  );
}
