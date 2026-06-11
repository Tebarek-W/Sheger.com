export type UserRole = "customer" | "business_owner" | "admin";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";
export type BusinessStatus = "pending" | "approved" | "rejected" | "suspended";

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
  price: number;
  duration_minutes: number;
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

export interface Booking {
  id: string;
  customer_id: string;
  business_id: string;
  service_id: string;
  employee_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
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

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category> };
      businesses: { Row: Business; Insert: Partial<Business>; Update: Partial<Business> };
      services: { Row: Service; Insert: Partial<Service>; Update: Partial<Service> };
      employees: { Row: Employee; Insert: Partial<Employee>; Update: Partial<Employee> };
      working_hours: {
        Row: WorkingHours;
        Insert: Partial<WorkingHours>;
        Update: Partial<WorkingHours>;
      };
      bookings: { Row: Booking; Insert: Partial<Booking>; Update: Partial<Booking> };
      reviews: { Row: Review; Insert: Partial<Review>; Update: Partial<Review> };
    };
    Enums: {
      user_role: UserRole;
      booking_status: BookingStatus;
      business_status: BusinessStatus;
    };
  };
}
