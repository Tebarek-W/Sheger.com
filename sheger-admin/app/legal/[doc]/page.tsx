import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { APP_NAME } from "@/constants/brand";
import {
  isLegalDocId,
  LEGAL_DOC_IDS,
  LEGAL_DOCS,
  LEGAL_LAST_UPDATED,
  SUPPORT_EMAIL,
  type LegalDocId,
} from "@/lib/legal/documents";

type PageProps = {
  params: Promise<{ doc: string }>;
};

export function generateStaticParams() {
  return LEGAL_DOC_IDS.map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { doc: docParam } = await params;
  if (!isLegalDocId(docParam)) {
    return { title: `Legal | ${APP_NAME}` };
  }
  const doc = LEGAL_DOCS[docParam];
  return {
    title: `${doc.title} | ${APP_NAME}`,
    description: doc.description,
  };
}

export default async function LegalDocumentPage({ params }: PageProps) {
  const { doc: docParam } = await params;
  if (!isLegalDocId(docParam)) notFound();

  const doc = LEGAL_DOCS[docParam as LegalDocId];

  return (
    <article>
      <Link href="/legal" className="text-sm font-medium text-[var(--primary)]">
        ← All legal documents
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[var(--primary-dark)]">{doc.title}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">Last updated: {LEGAL_LAST_UPDATED}</p>

      <div className="mt-8 space-y-6">
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-lg font-semibold text-[var(--primary-dark)]">{section.heading}</h2>
            <p className="mt-2 text-[15px] leading-7 text-[var(--muted)]">{section.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-[var(--muted)]">
        Contact:{" "}
        <a className="font-semibold text-[var(--primary)]" href={`mailto:${SUPPORT_EMAIL}`}>
          {SUPPORT_EMAIL}
        </a>
      </p>
    </article>
  );
}
