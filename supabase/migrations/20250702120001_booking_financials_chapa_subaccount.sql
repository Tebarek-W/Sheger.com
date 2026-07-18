-- booking_financials may predate split-payments migration (CREATE TABLE IF NOT EXISTS
-- does not add columns to an existing table).

ALTER TABLE public.booking_financials
  ADD COLUMN IF NOT EXISTS chapa_subaccount_id TEXT;
