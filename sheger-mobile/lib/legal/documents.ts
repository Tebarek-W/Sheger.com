export type LegalDocId = "terms" | "privacy" | "business" | "cancellation";

export type LegalDocMeta = {
  id: LegalDocId;
  titleKey: string;
  sections: { heading: string; body: string }[];
};

/**
 * Placeholder legal copy for product launch.
 * Replace with counsel-approved text before production / store submission.
 */
export const LEGAL_DOCS: Record<LegalDocId, LegalDocMeta> = {
  terms: {
    id: "terms",
    titleKey: "legal.termsTitle",
    sections: [
      {
        heading: "1. About Sheger",
        body: "Sheger is a marketplace that connects customers with local service businesses in Ethiopia (such as salons, barbershops, clinics, and similar providers). These Terms of Service govern your use of the Sheger mobile application and related services.",
      },
      {
        heading: "2. Accounts",
        body: "You must provide accurate information when creating an account. You are responsible for keeping your login credentials secure and for activity under your account. You must be old enough under Ethiopian law to enter a binding agreement.",
      },
      {
        heading: "3. Bookings",
        body: "When you book a service, you enter into an appointment arrangement with the business, facilitated by Sheger. Businesses set their own services, prices, hours, and availability. Sheger does not guarantee that a business will accept, confirm, or complete every booking.",
      },
      {
        heading: "4. Payments",
        body: "Fixed-price and minimum (“from”) amounts may be paid online through Chapa. Flexible-price services may require a minimum payment online, with any remaining balance paid at the business. Online payments are processed by Chapa; Sheger does not store your full card or wallet credentials. Platform commission may be deducted from amounts paid to businesses according to their subscription plan.",
      },
      {
        heading: "5. Cancellations and refunds",
        body: "Cancellation windows are set by each business and shown before you confirm. Refunds for online payments (including minimum deposits) are handled according to the business’s policy, Sheger’s cancellation rules, and Chapa’s processes. Contact support promptly if you believe a refund is due.",
      },
      {
        heading: "6. Acceptable use",
        body: "You may not misuse the app, attempt unauthorized access, post false information, harass others, or use Sheger for unlawful purposes. We may suspend or terminate accounts that violate these Terms.",
      },
      {
        heading: "7. Limitation of liability",
        body: "Sheger provides a booking and payment facilitation platform. Service quality, safety, and outcomes are the responsibility of the business you book. To the fullest extent permitted by law, Sheger is not liable for indirect or consequential damages arising from bookings or services provided by third-party businesses.",
      },
      {
        heading: "8. Changes",
        body: "We may update these Terms from time to time. Continued use of Sheger after changes means you accept the updated Terms. Material changes may be highlighted in the app.",
      },
      {
        heading: "9. Contact",
        body: "For questions about these Terms, contact Sheger support through the channels published by the platform operator. This document is a product placeholder and should be reviewed by legal counsel before production use.",
      },
    ],
  },
  privacy: {
    id: "privacy",
    titleKey: "legal.privacyTitle",
    sections: [
      {
        heading: "1. Information we collect",
        body: "We may collect account details (name, email, phone), booking history, device and app usage data, approximate or precise location (if you allow it for Nearby), and payment-related references from Chapa (not full payment credentials).",
      },
      {
        heading: "2. How we use information",
        body: "We use your information to operate bookings, payments, notifications, customer support, fraud prevention, and to improve Sheger. Business owners receive the booking details needed to fulfill appointments.",
      },
      {
        heading: "3. Sharing",
        body: "We share data with businesses you book, with payment providers such as Chapa, and with infrastructure providers (for example hosting and push notification services) as needed to run the platform. We do not sell your personal information.",
      },
      {
        heading: "4. Notifications and location",
        body: "Push notifications require your permission. Location is used for Nearby and map features when enabled; you can deny or revoke access in device settings.",
      },
      {
        heading: "5. Retention and security",
        body: "We retain information as long as needed for the purposes above and legal obligations. We use reasonable technical and organizational measures to protect data, but no system is perfectly secure.",
      },
      {
        heading: "6. Your choices",
        body: "You may update profile information in the app, request account deletion by contacting support, and manage notification and location permissions on your device.",
      },
      {
        heading: "7. Contact",
        body: "For privacy requests, contact Sheger support. This Privacy Policy is a product placeholder and should be reviewed by legal counsel before production use.",
      },
    ],
  },
  business: {
    id: "business",
    titleKey: "legal.businessTitle",
    sections: [
      {
        heading: "1. Business accounts",
        body: "If you register a business on Sheger, you represent that you are authorized to list that business, that your licenses and information are accurate, and that you will keep services, hours, and pricing up to date.",
      },
      {
        heading: "2. Marketplace visibility",
        body: "Listing and accepting bookings may require admin approval and an active subscription plan. Plan limits (services, weekly bookings, featured placement) apply as shown in the app.",
      },
      {
        heading: "3. Payouts and commission",
        body: "Online customer payments are processed via Chapa. You must configure a valid payout account. Sheger may retain a platform commission according to your plan. Settlement timing and bank/wallet rules follow Chapa and your payout setup.",
      },
      {
        heading: "4. Customer experience",
        body: "You are responsible for confirming or managing bookings, delivering services safely and lawfully, honoring stated prices and cancellation policies, and handling remaining balances for flexible-price services after any online minimum payment.",
      },
      {
        heading: "5. Prohibited conduct",
        body: "You may not list illegal services, misrepresent pricing, circumvent platform fees, abuse customer data, or use Sheger in ways that harm customers or the marketplace.",
      },
      {
        heading: "6. Suspension",
        body: "Sheger may suspend or remove listings that violate these Business Terms, fail compliance checks, or create risk for users or the platform.",
      },
      {
        heading: "7. Contact",
        body: "Questions about Business Terms can be directed to Sheger support. This document is a product placeholder and should be reviewed by legal counsel before production use.",
      },
    ],
  },
  cancellation: {
    id: "cancellation",
    titleKey: "legal.cancellationTitle",
    sections: [
      {
        heading: "1. Business cancellation windows",
        body: "Each business sets how many hours before an appointment a customer may cancel in the app while the booking is still pending. That policy is shown on the payment screen before you confirm.",
      },
      {
        heading: "2. After confirmation",
        body: "Once a business confirms a booking, in-app cancellation may no longer be available. Contact the business directly if you need to change or cancel.",
      },
      {
        heading: "3. Online payments and deposits",
        body: "If you paid online (including a minimum “from” amount), refund eligibility depends on timing, the business policy, and payment-provider rules. Paying a minimum online does not always mean the full final service price was settled.",
      },
      {
        heading: "4. No-shows",
        body: "Missing an appointment without cancelling in time may forfeit prepaid amounts according to the business’s policy.",
      },
      {
        heading: "5. Contact",
        body: "For help with a specific booking, use My bookings or contact Sheger support with your booking reference. This policy is a product placeholder and should be reviewed by legal counsel before production use.",
      },
    ],
  },
};

export function isLegalDocId(value: string): value is LegalDocId {
  return value in LEGAL_DOCS;
}
