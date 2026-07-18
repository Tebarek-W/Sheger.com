import type { Database, Tables } from "./database";

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
export type SubscriptionPayment = Tables<"subscription_payments">;
export type SubscriptionPlan = Tables<"subscription_plans">;

export type UserRole = Database["public"]["Enums"]["user_role"];
export type BookingStatus = Database["public"]["Enums"]["booking_status"];
export type BookingPaymentStatus = Database["public"]["Enums"]["booking_payment_status"];
export type BusinessStatus = Database["public"]["Enums"]["business_status"];
export type BusinessDocumentType = Database["public"]["Enums"]["business_document_type"];
export type BillingInterval = Database["public"]["Enums"]["billing_interval"];
export type ServicePricingModel = Database["public"]["Enums"]["service_pricing_model"];
export type ServiceDurationModel = Database["public"]["Enums"]["service_duration_model"];

export type SubscriptionSummary = {
  subscription: Tables<"business_subscriptions"> | null;
  current_plan: SubscriptionPlan | null;
  plans: SubscriptionPlan[];
  platform: { currency: string; grace_period_days: number };
  limits: { max_services: number; max_bookings_per_week: number };
  usage: { active_services: number; weekly_bookings: number };
  is_marketplace_live: boolean;
};
