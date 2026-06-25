// Keep in sync with supabase/types/database.ts

export type UserRole = "customer" | "business_owner" | "admin";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type BusinessStatus = "pending" | "approved" | "rejected" | "suspended";
export type BusinessDocumentType = "trade_license" | "health_facility_license";
export type BusinessDocumentStatus = "pending_review" | "approved" | "rejected";
export type ServicePricingModel = "fixed" | "starting_from" | "range" | "variable";
export type ServiceDurationModel = "fixed" | "estimated" | "flexible";
export type BillingInterval = "monthly" | "yearly";
export type SubscriptionStatus = "active" | "past_due" | "cancelled";
export type SubscriptionPaymentSource = "mock" | "admin_manual";

export interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_fee_etb: number;
  yearly_fee_etb: number;
  max_services: number;
  max_bookings_per_week: number;
  sort_order: number;
  is_active: boolean;
  is_featured_in_search: boolean;
  created_at: string;
  updated_at: string;
}

export interface BusinessSubscription {
  id: string;
  business_id: string;
  plan_id: string | null;
  status: SubscriptionStatus;
  billing_interval: BillingInterval | null;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPayment {
  id: string;
  business_id: string;
  plan_id: string | null;
  billing_interval: BillingInterval;
  amount_etb: number;
  payment_method: string;
  reference_code: string;
  period_start: string;
  period_end: string;
  source: SubscriptionPaymentSource;
  created_at: string;
}

export interface BusinessDocument {
  id: string;
  business_id: string;
  document_type: BusinessDocumentType;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  status: BusinessDocumentStatus;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Business {
  id: string;
  owner_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  cover_image_url: string | null;
  status: BusinessStatus;
  cancellation_hours: number;
  featured_in_search: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price: number | null;
  price_min: number | null;
  price_max: number | null;
  pricing_model: ServicePricingModel;
  duration_model: ServiceDurationModel;
  duration_minutes: number;
  scheduling_block_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Employee {
  id: string;
  business_id: string;
  full_name: string;
  role: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WorkingHours {
  id: string;
  business_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface AppointmentSlot {
  id: string;
  business_id: string;
  day_of_week: number;
  start_time: string;
  max_capacity: number;
  is_active: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  business_id: string;
  service_id: string;
  employee_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  scheduling_block_minutes: number;
  pricing_model: ServicePricingModel;
  duration_model: ServiceDurationModel;
  listed_price: number | null;
  listed_price_min: number | null;
  listed_price_max: number | null;
  final_price: number | null;
  actual_duration_minutes: number | null;
  status: BookingStatus;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  customer_id: string;
  business_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

type Relationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type TableDef<
  TRow,
  TInsert = Partial<TRow>,
  TUpdate = Partial<TRow>,
  TRelationships extends Relationship[] = [],
> = {
  Row: TRow & Record<string, unknown>;
  Insert: TInsert & Record<string, unknown>;
  Update: TUpdate & Record<string, unknown>;
  Relationships: TRelationships;
};

export type BookingInsert = {
  customer_id: string;
  business_id: string;
  service_id: string;
  employee_id?: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status?: BookingStatus;
  payment_method?: string | null;
  notes?: string | null;
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile, Partial<Profile> & { id: string }>;
      categories: TableDef<Category>;
      businesses: TableDef<
        Business,
        Partial<Business> & { owner_id: string; name: string },
        Partial<Business>,
        [
          {
            foreignKeyName: "businesses_category_id_fkey";
            columns: ["category_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "businesses_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ]
      >;
      services: TableDef<
        Service,
        Partial<Service> & {
          business_id: string;
          name: string;
          price: number;
          duration_minutes: number;
        },
        Partial<Service>,
        [
          {
            foreignKeyName: "services_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ]
      >;
      employees: TableDef<
        Employee,
        Partial<Employee> & { business_id: string; full_name: string },
        Partial<Employee>,
        [
          {
            foreignKeyName: "employees_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ]
      >;
      working_hours: TableDef<
        WorkingHours,
        Partial<WorkingHours> & {
          business_id: string;
          day_of_week: number;
          open_time: string;
          close_time: string;
        },
        Partial<WorkingHours>,
        [
          {
            foreignKeyName: "working_hours_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ]
      >;
      appointment_slots: TableDef<
        AppointmentSlot,
        Partial<AppointmentSlot> & {
          business_id: string;
          day_of_week: number;
          start_time: string;
          max_capacity: number;
        },
        Partial<AppointmentSlot>,
        [
          {
            foreignKeyName: "appointment_slots_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ]
      >;
      bookings: TableDef<
        Booking,
        BookingInsert,
        Partial<Booking>,
        [
          {
            foreignKeyName: "bookings_customer_id_fkey";
            columns: ["customer_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_service_id_fkey";
            columns: ["service_id"];
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_employee_id_fkey";
            columns: ["employee_id"];
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
        ]
      >;
      reviews: TableDef<Review, Partial<Review> & { booking_id: string; customer_id: string; business_id: string; rating: number }>;
      subscription_plans: TableDef<SubscriptionPlan>;
      business_subscriptions: TableDef<
        BusinessSubscription,
        Partial<BusinessSubscription> & { business_id: string },
        Partial<BusinessSubscription>,
        [
          {
            foreignKeyName: "business_subscriptions_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ]
      >;
      subscription_payments: TableDef<
        SubscriptionPayment,
        Partial<SubscriptionPayment> & {
          business_id: string;
          billing_interval: BillingInterval;
          amount_etb: number;
          payment_method: string;
          reference_code: string;
          period_start: string;
          period_end: string;
        },
        Partial<SubscriptionPayment>,
        [
          {
            foreignKeyName: "subscription_payments_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_payments_plan_id_fkey";
            columns: ["plan_id"];
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ]
      >;
      business_documents: TableDef<
        BusinessDocument,
        Partial<BusinessDocument> & {
          business_id: string;
          document_type: BusinessDocumentType;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size_bytes: number;
        },
        Partial<BusinessDocument>,
        [
          {
            foreignKeyName: "business_documents_business_id_fkey";
            columns: ["business_id"];
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ]
      >;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
      business_status: BusinessStatus;
      business_document_type: BusinessDocumentType;
      business_document_status: BusinessDocumentStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
