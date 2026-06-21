export type UserRole = "customer" | "business_owner" | "admin";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type BusinessStatus = "pending" | "approved" | "rejected" | "suspended";
export type NotificationType =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_new"
  | "booking_reminder_24h"
  | "booking_reminder_1h";
export type PushPlatform = "ios" | "android";
export type ReminderKind = "24h" | "1h";
export type ServicePricingModel = "fixed" | "starting_from" | "range" | "variable";
export type ServiceDurationModel = "fixed" | "estimated" | "flexible";

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

export interface PushToken {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: PushPlatform;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface BookingReminderDelivery {
  id: string;
  booking_id: string;
  reminder_kind: ReminderKind;
  sent_at: string;
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
      push_tokens: TableDef<
        PushToken,
        Partial<PushToken> & { user_id: string; expo_push_token: string; platform: PushPlatform }
      >;
      notifications: TableDef<
        Notification,
        Partial<Notification> & {
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
        }
      >;
      booking_reminder_deliveries: TableDef<
        BookingReminderDelivery,
        Partial<BookingReminderDelivery> & { booking_id: string; reminder_kind: ReminderKind }
      >;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_slot_booking_counts: {
        Args: {
          p_business_id: string;
          p_range_start: string;
          p_range_end: string;
        };
        Returns: {
          scheduled_at: string;
          booking_count: number;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
      business_status: BusinessStatus;
      notification_type: NotificationType;
      push_platform: PushPlatform;
      reminder_kind: ReminderKind;
      service_pricing_model: ServicePricingModel;
      service_duration_model: ServiceDurationModel;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
