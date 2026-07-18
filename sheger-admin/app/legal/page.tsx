import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL_DOC_IDS, LEGAL_DOCS } from "@/lib/legal/documents";

export const metadata: Metadata = {
  title: "Legal | Sheger",
  description: "Sheger Terms, Privacy Policy, Business Terms, and Cancellation policy.",
};

export default function LegalIndexPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Legal</h1>
      <p className="mt-2 text-[var(--muted)]">
        Public policies for the Sheger mobile app. Use these URLs in Play Store and App Store
        listings.
      </p>
      <ul className="mt-8 space-y-3">
        {LEGAL_DOC_IDS.map((id) => {
          const doc = LEGAL_DOCS[id];
          return (
            <li key={id}>
              <Link
                href={`/legal/${id}`}
                className="block rounded-2xl border border-[var(--border)] bg-white px-5 py-4 hover:border-[var(--primary)]"
              >
                <p className="font-semibold text-[var(--primary-dark)]">{doc.title}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{doc.description}</p>
                <p className="mt-2 text-xs font-medium text-[var(--primary)]">
                  /legal/{id}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
