import { create } from "zustand";

import type { Business, Service } from "@/lib/types/database";

type BookingDraft = {
  business: Business | null;
  service: Service | null;
  employeeId: string | null;
  scheduledAt: string | null;
  paymentMethod: string | null;
  bookingId: string | null;
};

type BookingStore = BookingDraft & {
  setBusiness: (business: Business) => void;
  setService: (service: Service) => void;
  setEmployeeId: (employeeId: string | null) => void;
  setScheduledAt: (scheduledAt: string | null) => void;
  setPaymentMethod: (paymentMethod: string) => void;
  setBookingId: (bookingId: string) => void;
  reset: () => void;
};

const initial: BookingDraft = {
  business: null,
  service: null,
  employeeId: null,
  scheduledAt: null,
  paymentMethod: null,
  bookingId: null,
};

export const useBookingStore = create<BookingStore>((set) => ({
  ...initial,
  setBusiness: (business) => set({ business }),
  setService: (service) => set({ service }),
  setEmployeeId: (employeeId) => set({ employeeId }),
  setScheduledAt: (scheduledAt) => set({ scheduledAt }),
  setPaymentMethod: (paymentMethod) => set({ paymentMethod }),
  setBookingId: (bookingId) => set({ bookingId }),
  reset: () => set(initial),
}));
