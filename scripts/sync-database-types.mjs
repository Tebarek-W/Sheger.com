import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "supabase", "types", "database.ts");
const targets = [
  join(root, "sheger-mobile", "lib", "types", "database.ts"),
  join(root, "sheger-admin", "lib", "types", "database.ts"),
];

const header = "// Keep in sync with supabase/types/database.ts\n// Run: npm run db:types (after supabase link) or npm run db:types:sync\n\n";
const body = readFileSync(source, "utf8").replace(/^\/\/ Keep in sync.*\n(\/\/ Run:.*\n)?/m, "");

for (const target of targets) {
  writeFileSync(target, header + body, "utf8");
  console.log(`Synced ${target}`);
}

const mobileAliases = join(root, "sheger-mobile", "lib", "types", "database.ts");
const mobileBody = readFileSync(mobileAliases, "utf8");
if (!mobileBody.includes('export * from "./aliases"')) {
  writeFileSync(
    mobileAliases,
    `${mobileBody.trimEnd()}\n\nexport * from "./aliases";\n`,
    "utf8",
  );
  console.log("Appended aliases re-export to sheger-mobile/lib/types/database.ts");
}

const adminAliasBlock = `
export type Profile = Tables<"profiles">;
export type Business = Tables<"businesses">;
export type Category = Tables<"categories">;
export type Service = Tables<"services">;
export type Employee = Tables<"employees">;
export type Booking = Tables<"bookings">;
export type Review = Tables<"reviews">;
export type WorkingHours = Tables<"working_hours">;
export type AppointmentSlot = Tables<"appointment_slots">;
export type BusinessDocument = Tables<"business_documents">;
export type SubscriptionPlan = Tables<"subscription_plans">;
export type SubscriptionPayment = Tables<"subscription_payments">;

export type UserRole = Database["public"]["Enums"]["user_role"];
export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type BookingPaymentStatus = Database["public"]["Enums"]["booking_payment_status"];
export type BusinessStatus = Database["public"]["Enums"]["business_status"];
export type BusinessDocumentType = Database["public"]["Enums"]["business_document_type"];
export type BusinessDocumentStatus = Database["public"]["Enums"]["business_document_status"];
export type BillingInterval = Database["public"]["Enums"]["billing_interval"];
export type ServicePricingModel = Database["public"]["Enums"]["service_pricing_model"];
export type ServiceDurationModel = Database["public"]["Enums"]["service_duration_model"];
`.trimStart();

const adminDb = join(root, "sheger-admin", "lib", "types", "database.ts");
const adminBody = readFileSync(adminDb, "utf8");
if (!adminBody.includes("export type BusinessDocument")) {
  writeFileSync(adminDb, `${adminBody.trimEnd()}\n\n${adminAliasBlock}`, "utf8");
  console.log("Appended type aliases to sheger-admin/lib/types/database.ts");
}
