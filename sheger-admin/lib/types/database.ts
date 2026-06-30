// Keep in sync with supabase/types/database.ts
// Run: npm run db:types (after supabase link) or npm run db:types:sync

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointment_slots: {
        Row: {
          business_id: string
          created_at: string
          day_of_week: number
          id: string
          is_active: boolean
          max_capacity: number
          start_time: string
        }
        Insert: {
          business_id: string
          created_at?: string
          day_of_week: number
          id?: string
          is_active?: boolean
          max_capacity?: number
          start_time: string
        }
        Update: {
          business_id?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_active?: boolean
          max_capacity?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_slots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_financials: {
        Row: {
          booking_id: string
          business_id: string
          commission_amount_etb: number
          commission_rate: number
          created_at: string
          currency: string
          id: string
          owner_net_etb: number
          platform_fee_etb: number
          service_price_etb: number
        }
        Insert: {
          booking_id: string
          business_id: string
          commission_amount_etb: number
          commission_rate: number
          created_at?: string
          currency?: string
          id?: string
          owner_net_etb: number
          platform_fee_etb: number
          service_price_etb: number
        }
        Update: {
          booking_id?: string
          business_id?: string
          commission_amount_etb?: number
          commission_rate?: number
          created_at?: string
          currency?: string
          id?: string
          owner_net_etb?: number
          platform_fee_etb?: number
          service_price_etb?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_financials_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_financials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_reminder_deliveries: {
        Row: {
          booking_id: string
          id: string
          reminder_kind: Database["public"]["Enums"]["reminder_kind"]
          sent_at: string
        }
        Insert: {
          booking_id: string
          id?: string
          reminder_kind: Database["public"]["Enums"]["reminder_kind"]
          sent_at?: string
        }
        Update: {
          booking_id?: string
          id?: string
          reminder_kind?: Database["public"]["Enums"]["reminder_kind"]
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_reminder_deliveries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          actual_duration_minutes: number | null
          business_id: string
          created_at: string
          customer_id: string
          duration_minutes: number
          duration_model: Database["public"]["Enums"]["service_duration_model"]
          employee_id: string | null
          final_price: number | null
          id: string
          listed_price: number | null
          listed_price_max: number | null
          listed_price_min: number | null
          metadata: Json
          notes: string | null
          paid_amount_etb: number | null
          paid_at: string | null
          payment_expires_at: string | null
          payment_method: string | null
          payment_status: Database["public"]["Enums"]["booking_payment_status"]
          payment_status_legacy: Database["public"]["Enums"]["payment_status"]
          pricing_model: Database["public"]["Enums"]["service_pricing_model"]
          scheduled_at: string
          scheduling_block_minutes: number
          service_id: string
          service_price_snapshot: number | null
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          business_id: string
          created_at?: string
          customer_id: string
          duration_minutes: number
          duration_model?: Database["public"]["Enums"]["service_duration_model"]
          employee_id?: string | null
          final_price?: number | null
          id?: string
          listed_price?: number | null
          listed_price_max?: number | null
          listed_price_min?: number | null
          metadata?: Json
          notes?: string | null
          paid_amount_etb?: number | null
          paid_at?: string | null
          payment_expires_at?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["booking_payment_status"]
          payment_status_legacy?: Database["public"]["Enums"]["payment_status"]
          pricing_model?: Database["public"]["Enums"]["service_pricing_model"]
          scheduled_at: string
          scheduling_block_minutes?: number
          service_id: string
          service_price_snapshot?: number | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Update: {
          actual_duration_minutes?: number | null
          business_id?: string
          created_at?: string
          customer_id?: string
          duration_minutes?: number
          duration_model?: Database["public"]["Enums"]["service_duration_model"]
          employee_id?: string | null
          final_price?: number | null
          id?: string
          listed_price?: number | null
          listed_price_max?: number | null
          listed_price_min?: number | null
          metadata?: Json
          notes?: string | null
          paid_amount_etb?: number | null
          paid_at?: string | null
          payment_expires_at?: string | null
          payment_method?: string | null
          payment_status?: Database["public"]["Enums"]["booking_payment_status"]
          payment_status_legacy?: Database["public"]["Enums"]["payment_status"]
          pricing_model?: Database["public"]["Enums"]["service_pricing_model"]
          scheduled_at?: string
          scheduling_block_minutes?: number
          service_id?: string
          service_price_snapshot?: number | null
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      business_chapa_subaccounts: {
        Row: {
          account_name: string
          account_number: string
          bank_code: number
          business_id: string
          business_name: string | null
          chapa_subaccount_id: string
          created_at: string
          split_type: string
          split_value: number
          status: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code: number
          business_id: string
          business_name?: string | null
          chapa_subaccount_id: string
          created_at?: string
          split_type?: string
          split_value: number
          status?: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: number
          business_id?: string
          business_name?: string | null
          chapa_subaccount_id?: string
          created_at?: string
          split_type?: string
          split_value?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_chapa_subaccounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_documents: {
        Row: {
          business_id: string
          created_at: string
          document_type: Database["public"]["Enums"]["business_document_type"]
          file_name: string
          file_size_bytes: number
          id: string
          mime_type: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["business_document_status"]
          storage_path: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          document_type: Database["public"]["Enums"]["business_document_type"]
          file_name: string
          file_size_bytes: number
          id?: string
          mime_type: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["business_document_status"]
          storage_path: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          document_type?: Database["public"]["Enums"]["business_document_type"]
          file_name?: string
          file_size_bytes?: number
          id?: string
          mime_type?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["business_document_status"]
          storage_path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_promotions: {
        Row: {
          amount_paid_etb: number
          business_id: string
          created_at: string
          ends_at: string
          id: string
          priority: number
          promotion_type: Database["public"]["Enums"]["promotion_type"]
          starts_at: string
          status: Database["public"]["Enums"]["promotion_status"]
        }
        Insert: {
          amount_paid_etb?: number
          business_id: string
          created_at?: string
          ends_at: string
          id?: string
          priority?: number
          promotion_type: Database["public"]["Enums"]["promotion_type"]
          starts_at: string
          status?: Database["public"]["Enums"]["promotion_status"]
        }
        Update: {
          amount_paid_etb?: number
          business_id?: string
          created_at?: string
          ends_at?: string
          id?: string
          priority?: number
          promotion_type?: Database["public"]["Enums"]["promotion_type"]
          starts_at?: string
          status?: Database["public"]["Enums"]["promotion_status"]
        }
        Relationships: [
          {
            foreignKeyName: "business_promotions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_subscriptions: {
        Row: {
          billing_interval:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          business_id: string
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          grace_ends_at: string | null
          id: string
          max_bookings_per_week: number | null
          max_services: number | null
          plan_id: string | null
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
        }
        Insert: {
          billing_interval?:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          business_id: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_ends_at?: string | null
          id?: string
          max_bookings_per_week?: number | null
          max_services?: number | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Update: {
          billing_interval?:
            | Database["public"]["Enums"]["billing_interval"]
            | null
          business_id?: string
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          grace_ends_at?: string | null
          id?: string
          max_bookings_per_week?: number | null
          max_services?: number | null
          plan_id?: string | null
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_subscriptions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          cancellation_hours: number
          category_id: string | null
          city: string | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          email: string | null
          featured_in_search: boolean
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          owner_id: string
          phone: string | null
          status: Database["public"]["Enums"]["business_status"]
          updated_at: string
        }
        Insert: {
          address?: string | null
          cancellation_hours?: number
          category_id?: string | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          featured_in_search?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          owner_id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["business_status"]
          updated_at?: string
        }
        Update: {
          address?: string | null
          cancellation_hours?: number
          category_id?: string | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string | null
          featured_in_search?: boolean
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          owner_id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["business_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      employees: {
        Row: {
          avatar_url: string | null
          business_id: string
          created_at: string
          full_name: string
          id: string
          is_active: boolean
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          business_id: string
          created_at?: string
          full_name: string
          id?: string
          is_active?: boolean
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          business_id?: string
          created_at?: string
          full_name?: string
          id?: string
          is_active?: boolean
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          body: string
          claimed_at: string | null
          created_at: string
          data: Json
          expo_push_token: string
          id: string
          last_error: string | null
          notification_id: string
          sent_at: string | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body: string
          claimed_at?: string | null
          created_at?: string
          data?: Json
          expo_push_token: string
          id?: string
          last_error?: string | null
          notification_id: string
          sent_at?: string | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string
          claimed_at?: string | null
          created_at?: string
          data?: Json
          expo_push_token?: string
          id?: string
          last_error?: string | null
          notification_id?: string
          sent_at?: string | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json
          id: string
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json
          id?: string
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount_etb: number
          booking_id: string | null
          chapa_mode: string
          chapa_reference: string | null
          chapa_subaccount_id: string | null
          commission_amount_etb: number | null
          commission_rate: number | null
          created_at: string
          currency: string
          id: string
          metadata: Json
          owner_net_etb: number | null
          payment_method: string | null
          purpose: Database["public"]["Enums"]["payment_purpose"]
          status: Database["public"]["Enums"]["payment_transaction_status"]
          tx_ref: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          amount_etb: number
          booking_id?: string | null
          chapa_mode?: string
          chapa_reference?: string | null
          chapa_subaccount_id?: string | null
          commission_amount_etb?: number | null
          commission_rate?: number | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          owner_net_etb?: number | null
          payment_method?: string | null
          purpose?: Database["public"]["Enums"]["payment_purpose"]
          status?: Database["public"]["Enums"]["payment_transaction_status"]
          tx_ref: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          amount_etb?: number
          booking_id?: string | null
          chapa_mode?: string
          chapa_reference?: string | null
          chapa_subaccount_id?: string | null
          commission_amount_etb?: number | null
          commission_rate?: number | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json
          owner_net_etb?: number | null
          payment_method?: string | null
          purpose?: Database["public"]["Enums"]["payment_purpose"]
          status?: Database["public"]["Enums"]["payment_transaction_status"]
          tx_ref?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          currency: string
          default_booking_commission_rate: number
          default_max_bookings_per_week: number
          default_max_services: number
          feature_flags: Json
          grace_period_days: number
          id: number
          monthly_fee_etb: number
          updated_at: string
          yearly_fee_etb: number
        }
        Insert: {
          currency?: string
          default_booking_commission_rate?: number
          default_max_bookings_per_week?: number
          default_max_services?: number
          feature_flags?: Json
          grace_period_days?: number
          id?: number
          monthly_fee_etb?: number
          updated_at?: string
          yearly_fee_etb?: number
        }
        Update: {
          currency?: string
          default_booking_commission_rate?: number
          default_max_bookings_per_week?: number
          default_max_services?: number
          feature_flags?: Json
          grace_period_days?: number
          id?: number
          monthly_fee_etb?: number
          updated_at?: string
          yearly_fee_etb?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferences: Json
          referral_code: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferences?: Json
          referral_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferences?: Json
          referral_code?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      promoted_listings: {
        Row: {
          amount_paid_etb: number
          business_id: string
          category_id: string | null
          clicks: number
          created_at: string
          ends_at: string
          headline: string
          id: string
          image_url: string | null
          impressions: number
          placement: Database["public"]["Enums"]["ad_placement"]
          starts_at: string
          status: Database["public"]["Enums"]["ad_status"]
        }
        Insert: {
          amount_paid_etb?: number
          business_id: string
          category_id?: string | null
          clicks?: number
          created_at?: string
          ends_at: string
          headline: string
          id?: string
          image_url?: string | null
          impressions?: number
          placement: Database["public"]["Enums"]["ad_placement"]
          starts_at: string
          status?: Database["public"]["Enums"]["ad_status"]
        }
        Update: {
          amount_paid_etb?: number
          business_id?: string
          category_id?: string | null
          clicks?: number
          created_at?: string
          ends_at?: string
          headline?: string
          id?: string
          image_url?: string | null
          impressions?: number
          placement?: Database["public"]["Enums"]["ad_placement"]
          starts_at?: string
          status?: Database["public"]["Enums"]["ad_status"]
        }
        Relationships: [
          {
            foreignKeyName: "promoted_listings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promoted_listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          expo_push_token: string
          id: string
          platform: Database["public"]["Enums"]["push_platform"]
          updated_at: string
          user_id: string
        }
        Insert: {
          expo_push_token: string
          id?: string
          platform: Database["public"]["Enums"]["push_platform"]
          updated_at?: string
          user_id: string
        }
        Update: {
          expo_push_token?: string
          id?: string
          platform?: Database["public"]["Enums"]["push_platform"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          booking_id: string
          business_id: string
          comment: string | null
          created_at: string
          customer_id: string
          id: string
          rating: number
        }
        Insert: {
          booking_id: string
          business_id: string
          comment?: string | null
          created_at?: string
          customer_id: string
          id?: string
          rating: number
        }
        Update: {
          booking_id?: string
          business_id?: string
          comment?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          duration_minutes: number
          duration_model: Database["public"]["Enums"]["service_duration_model"]
          id: string
          is_active: boolean
          name: string
          price: number | null
          price_max: number | null
          price_min: number | null
          pricing_model: Database["public"]["Enums"]["service_pricing_model"]
          scheduling_block_minutes: number | null
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          duration_model?: Database["public"]["Enums"]["service_duration_model"]
          id?: string
          is_active?: boolean
          name: string
          price?: number | null
          price_max?: number | null
          price_min?: number | null
          pricing_model?: Database["public"]["Enums"]["service_pricing_model"]
          scheduling_block_minutes?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number
          duration_model?: Database["public"]["Enums"]["service_duration_model"]
          id?: string
          is_active?: boolean
          name?: string
          price?: number | null
          price_max?: number | null
          price_min?: number | null
          pricing_model?: Database["public"]["Enums"]["service_pricing_model"]
          scheduling_block_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          amount_etb: number
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          business_id: string
          created_at: string
          id: string
          payment_method: string
          period_end: string
          period_start: string
          plan_id: string | null
          reference_code: string
          source: Database["public"]["Enums"]["subscription_payment_source"]
        }
        Insert: {
          amount_etb: number
          billing_interval: Database["public"]["Enums"]["billing_interval"]
          business_id: string
          created_at?: string
          id?: string
          payment_method: string
          period_end: string
          period_start: string
          plan_id?: string | null
          reference_code: string
          source?: Database["public"]["Enums"]["subscription_payment_source"]
        }
        Update: {
          amount_etb?: number
          billing_interval?: Database["public"]["Enums"]["billing_interval"]
          business_id?: string
          created_at?: string
          id?: string
          payment_method?: string
          period_end?: string
          period_start?: string
          plan_id?: string | null
          reference_code?: string
          source?: Database["public"]["Enums"]["subscription_payment_source"]
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          commission_rate: number
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_featured_in_search: boolean
          max_bookings_per_week: number
          max_services: number
          monthly_fee_etb: number
          monthly_price_etb: number
          name: string
          slug: string
          sort_order: number
          updated_at: string
          yearly_fee_etb: number
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_featured_in_search?: boolean
          max_bookings_per_week?: number
          max_services?: number
          monthly_fee_etb?: number
          monthly_price_etb?: number
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
          yearly_fee_etb?: number
        }
        Update: {
          commission_rate?: number
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_featured_in_search?: boolean
          max_bookings_per_week?: number
          max_services?: number
          monthly_fee_etb?: number
          monthly_price_etb?: number
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
          yearly_fee_etb?: number
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount_etb: number
          booking_id: string | null
          business_id: string
          created_at: string
          id: string
          metadata: Json
          payment_method: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          provider_ref: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at: string
        }
        Insert: {
          amount_etb: number
          booking_id?: string | null
          business_id: string
          created_at?: string
          id?: string
          metadata?: Json
          payment_method?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Update: {
          amount_etb?: number
          booking_id?: string | null
          business_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          payment_method?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      working_hours: {
        Row: {
          business_id: string
          close_time: string
          day_of_week: number
          id: string
          is_closed: boolean
          open_time: string
        }
        Insert: {
          business_id: string
          close_time: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          open_time: string
        }
        Update: {
          business_id?: string
          close_time?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          open_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      addis_week_bounds: {
        Args: never
        Returns: {
          week_end: string
          week_start: string
        }[]
      }
      business_active_service_count: {
        Args: { p_business_id: string }
        Returns: number
      }
      business_can_accept_booking: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      business_is_marketplace_live: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      business_required_document_types: {
        Args: { p_business_id: string }
        Returns: Database["public"]["Enums"]["business_document_type"][]
      }
      business_requires_health_facility_license: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      business_subscription_allows_bookings: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      business_subscription_limits: {
        Args: { p_business_id: string }
        Returns: {
          max_bookings_per_week: number
          max_services: number
        }[]
      }
      business_weekly_booking_count: {
        Args: { p_business_id: string }
        Returns: number
      }
      claim_notification_deliveries: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          body: string
          data: Json
          expo_push_token: string
          id: string
          notification_id: string
          title: string
          user_id: string
        }[]
      }
      compute_booking_split: {
        Args: { p_amount: number; p_business_id: string }
        Returns: Json
      }
      enqueue_notification_deliveries: {
        Args: {
          p_body: string
          p_data?: Json
          p_notification_id: string
          p_title: string
          p_user_id: string
        }
        Returns: number
      }
      expire_unpaid_bookings: { Args: never; Returns: number }
      finalize_chapa_payment: {
        Args: {
          p_amount: number
          p_chapa_mode: string
          p_chapa_reference: string
          p_payment_method: string
          p_tx_ref: string
        }
        Returns: Json
      }
      finish_notification_delivery: {
        Args: { p_delivery_id: string; p_error?: string; p_status: string }
        Returns: undefined
      }
      get_active_featured_business_ids: {
        Args: never
        Returns: {
          business_id: string
          priority: number
        }[]
      }
      get_admin_dashboard_snapshot: { Args: never; Returns: Json }
      get_admin_dashboard_timeseries: {
        Args: { p_period: string }
        Returns: Json
      }
      get_admin_reports_snapshot: { Args: never; Returns: Json }
      get_business_commission_rate: {
        Args: { p_business_id: string }
        Returns: number
      }
      get_business_plan_features: {
        Args: { p_business_id: string }
        Returns: Json
      }
      get_business_rating_summaries: {
        Args: never
        Returns: {
          average: number
          business_id: string
          review_count: number
        }[]
      }
      get_owner_booking_stats: {
        Args: { p_business_id: string }
        Returns: Json
      }
      get_platform_setting: { Args: { p_key: string }; Returns: Json }
      get_slot_booking_counts: {
        Args: {
          p_business_id: string
          p_range_end: string
          p_range_start: string
        }
        Returns: {
          booking_count: number
          scheduled_at: string
        }[]
      }
      get_subscription_summary: {
        Args: { p_business_id: string }
        Returns: Json
      }
      increment_promoted_listing_clicks: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      list_active_subscription_plans: {
        Args: never
        Returns: {
          commission_rate: number
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_featured_in_search: boolean
          max_bookings_per_week: number
          max_services: number
          monthly_fee_etb: number
          monthly_price_etb: number
          name: string
          slug: string
          sort_order: number
          updated_at: string
          yearly_fee_etb: number
        }[]
        SetofOptions: {
          from: "*"
          to: "subscription_plans"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_business_booking_cards_page: {
        Args: {
          p_business_id: string
          p_cursor_id?: string
          p_cursor_scheduled_at?: string
          p_limit?: number
        }
        Returns: Json
      }
      list_business_bookings_page: {
        Args: {
          p_business_id: string
          p_cursor_id?: string
          p_cursor_scheduled_at?: string
          p_limit?: number
        }
        Returns: Json
      }
      list_customer_booking_cards_page: {
        Args: {
          p_cursor_id?: string
          p_cursor_scheduled_at?: string
          p_limit?: number
        }
        Returns: Json
      }
      list_customer_bookings_page: {
        Args: {
          p_cursor_id?: string
          p_cursor_scheduled_at?: string
          p_limit?: number
        }
        Returns: Json
      }
      list_marketplace_businesses_page: {
        Args: {
          p_category_id?: string
          p_city?: string
          p_cursor_featured?: boolean
          p_cursor_id?: string
          p_cursor_name?: string
          p_latitude?: number
          p_limit?: number
          p_longitude?: number
          p_min_rating?: number
          p_price_max?: number
          p_price_min?: number
          p_query?: string
          p_radius_km?: number
        }
        Returns: Json
      }
      mark_subscriptions_past_due: { Args: never; Returns: number }
      record_subscription_payment: {
        Args: {
          p_billing_interval: Database["public"]["Enums"]["billing_interval"]
          p_business_id: string
          p_payment_method: string
          p_plan_id: string
        }
        Returns: Json
      }
      seed_default_working_hours: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      storage_business_image_owner_check: {
        Args: { object_name: string }
        Returns: boolean
      }
      storage_business_owner_check: {
        Args: { object_name: string }
        Returns: boolean
      }
      sync_business_featured_search: {
        Args: { p_business_id: string }
        Returns: undefined
      }
    }
    Enums: {
      ad_placement: "home_banner" | "category_top" | "search_top"
      ad_status: "pending_review" | "active" | "rejected" | "expired"
      billing_interval: "monthly" | "yearly"
      booking_payment_status:
        | "not_required"
        | "awaiting_payment"
        | "paid"
        | "failed"
      booking_status: "pending" | "confirmed" | "cancelled" | "completed"
      business_document_status: "pending_review" | "approved" | "rejected"
      business_document_type: "trade_license" | "health_facility_license"
      business_status: "pending" | "approved" | "rejected" | "suspended"
      notification_type:
        | "booking_confirmed"
        | "booking_cancelled"
        | "booking_new"
        | "booking_reminder_24h"
        | "booking_reminder_1h"
      payment_provider: "chapa" | "manual"
      payment_purpose: "booking" | "subscription"
      payment_status:
        | "unpaid"
        | "pending"
        | "paid"
        | "failed"
        | "refunded"
        | "cash_pending"
      payment_transaction_status:
        | "initialized"
        | "success"
        | "failed"
        | "cancelled"
      promotion_status: "pending" | "active" | "expired" | "cancelled"
      promotion_type: "featured_search" | "category_banner" | "home_spotlight"
      push_platform: "ios" | "android"
      reminder_kind: "24h" | "1h"
      service_duration_model: "fixed" | "estimated" | "flexible"
      service_pricing_model: "fixed" | "starting_from" | "range" | "variable"
      subscription_payment_source: "mock" | "admin_manual"
      subscription_status: "trialing" | "active" | "past_due" | "cancelled"
      transaction_status: "pending" | "succeeded" | "failed" | "refunded"
      transaction_type:
        | "booking_payment"
        | "subscription"
        | "promotion"
        | "refund"
        | "payout"
      user_role: "customer" | "business_owner" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ad_placement: ["home_banner", "category_top", "search_top"],
      ad_status: ["pending_review", "active", "rejected", "expired"],
      billing_interval: ["monthly", "yearly"],
      booking_payment_status: [
        "not_required",
        "awaiting_payment",
        "paid",
        "failed",
      ],
      booking_status: ["pending", "confirmed", "cancelled", "completed"],
      business_document_status: ["pending_review", "approved", "rejected"],
      business_document_type: ["trade_license", "health_facility_license"],
      business_status: ["pending", "approved", "rejected", "suspended"],
      notification_type: [
        "booking_confirmed",
        "booking_cancelled",
        "booking_new",
        "booking_reminder_24h",
        "booking_reminder_1h",
      ],
      payment_provider: ["chapa", "manual"],
      payment_purpose: ["booking", "subscription"],
      payment_status: [
        "unpaid",
        "pending",
        "paid",
        "failed",
        "refunded",
        "cash_pending",
      ],
      payment_transaction_status: [
        "initialized",
        "success",
        "failed",
        "cancelled",
      ],
      promotion_status: ["pending", "active", "expired", "cancelled"],
      promotion_type: ["featured_search", "category_banner", "home_spotlight"],
      push_platform: ["ios", "android"],
      reminder_kind: ["24h", "1h"],
      service_duration_model: ["fixed", "estimated", "flexible"],
      service_pricing_model: ["fixed", "starting_from", "range", "variable"],
      subscription_payment_source: ["mock", "admin_manual"],
      subscription_status: ["trialing", "active", "past_due", "cancelled"],
      transaction_status: ["pending", "succeeded", "failed", "refunded"],
      transaction_type: [
        "booking_payment",
        "subscription",
        "promotion",
        "refund",
        "payout",
      ],
      user_role: ["customer", "business_owner", "admin"],
    },
  },
} as const

/** Convenience row/enum aliases used by sheger-admin and sheger-mobile. */
export type Profile = Tables<"profiles">
export type Business = Tables<"businesses">
export type Category = Tables<"categories">
export type Employee = Tables<"employees">
export type Service = Tables<"services">
export type Booking = Tables<"bookings">
export type Review = Tables<"reviews">
export type WorkingHours = Tables<"working_hours">
export type AppointmentSlot = Tables<"appointment_slots">
export type BusinessDocument = Tables<"business_documents">
export type SubscriptionPlan = Tables<"subscription_plans">
export type SubscriptionPayment = Tables<"subscription_payments">
export type BusinessSubscription = Tables<"business_subscriptions">

export type UserRole = Enums<"user_role">
export type BusinessStatus = Enums<"business_status">
export type BookingStatus = Enums<"booking_status">
export type BookingPaymentStatus = Enums<"booking_payment_status">
export type BusinessDocumentStatus = Enums<"business_document_status">
export type BusinessDocumentType = Enums<"business_document_type">
export type BillingInterval = Enums<"billing_interval">
export type ServiceDurationModel = Enums<"service_duration_model">
export type ServicePricingModel = Enums<"service_pricing_model">

/** JSON shape returned by get_subscription_summary RPC. */
export type SubscriptionSummary = {
  subscription: BusinessSubscription | null
  current_plan: SubscriptionPlan | null
  plans: SubscriptionPlan[]
  platform: {
    currency: string
    grace_period_days: number
  }
  limits: {
    max_services: number
    max_bookings_per_week: number
  }
  usage: {
    active_services: number
    weekly_bookings: number
  }
  is_marketplace_live: boolean
}
