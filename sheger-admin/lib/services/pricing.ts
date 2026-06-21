type BookingRevenueRow = {
  final_price?: number | null;
  listed_price?: number | null;
  listed_price_min?: number | null;
  services?: { price: number | null } | null;
};

export function getBookingRevenueAmount(row: BookingRevenueRow): number {
  if (row.final_price != null) return Number(row.final_price);
  if (row.listed_price != null) return Number(row.listed_price);
  if (row.listed_price_min != null) return Number(row.listed_price_min);
  return Number(row.services?.price ?? 0);
}

export function formatBookingPrice(row: BookingRevenueRow & {
  pricing_model?: string;
  listed_price_max?: number | null;
}): string {
  if (row.final_price != null) {
    return `${Number(row.final_price).toFixed(0)} ETB`;
  }
  if (row.listed_price != null) {
    return `${Number(row.listed_price).toFixed(0)} ETB`;
  }
  if (row.listed_price_min != null && row.listed_price_max != null) {
    return `${Number(row.listed_price_min).toFixed(0)} – ${Number(row.listed_price_max).toFixed(0)} ETB`;
  }
  if (row.listed_price_min != null) {
    return `From ${Number(row.listed_price_min).toFixed(0)} ETB`;
  }
  if (row.services?.price != null) {
    return `${Number(row.services.price).toFixed(0)} ETB`;
  }
  return "Price at visit";
}
