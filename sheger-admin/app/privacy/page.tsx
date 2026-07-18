import { permanentRedirect } from "next/navigation";

/** Short store-friendly alias for Privacy Policy. */
export default function PrivacyAliasPage() {
  permanentRedirect("/legal/privacy");
}
