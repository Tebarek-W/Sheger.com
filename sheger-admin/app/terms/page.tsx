import { permanentRedirect } from "next/navigation";

/** Short store-friendly alias for Terms of Service. */
export default function TermsAliasPage() {
  permanentRedirect("/legal/terms");
}
