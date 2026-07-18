# Sheger backend conventions

Guidelines for extending the Supabase backend without major refactors.

## Schema changes

- Add **new migrations** under `supabase/migrations/`; never edit applied migrations.
- Use idempotent patterns: `IF NOT EXISTS`, `DO $$ … EXCEPTION WHEN duplicate_object`.
- **Enums**: extend with `ALTER TYPE … ADD VALUE` in a new migration (do not create parallel enums).
- **Feature flags**: use `platform_settings.feature_flags` JSONB until a feature is stable.
- **Per-row extensions**: use `bookings.metadata` or `profiles.preferences` JSONB for experimental fields; promote to columns once the shape is fixed.

## Payments

- All money movement goes through `payment_transactions` + `payment_purpose` (`booking`, `subscription`).
- Finalize via `SECURITY DEFINER` RPCs (e.g. `finalize_chapa_payment`); clients must not set `payment_status` or `paid_amount_etb` on bookings.
- Apply discounts/coupons **before** calling Chapa initialize (amount must match at charge time).

## Notifications

- Extend `notification_type` enum for new alert kinds.
- Insert rows via edge functions / service role (`deliverNotification` in `_shared/notifications.ts`).
- Do not store chat messages in `notifications`; chat will use its own tables + Realtime.

## List / pagination RPCs

Template: `list_*_page(limit, cursor_*)` → JSONB:

```json
{
  "rows": [ … ],
  "next_cursor": { "scheduled_at": "…", "id": "…" } | null,
  "limit": 20
}
```

- `SECURITY INVOKER` so RLS applies.
- Cursor: `(scheduled_at, id)` tuple, `ORDER BY scheduled_at DESC, id DESC`.
- Default limit 20, max 100.

Existing RPCs:

| Function | Caller |
|----------|--------|
| `list_customer_bookings_page` | Customer (`auth.uid()`) |
| `list_business_bookings_page` | Business owner or admin |

Add similar RPCs for businesses discovery, favorites, messages when those features ship.

## Edge functions

See [ops/EDGE_FUNCTIONS.md](./ops/EDGE_FUNCTIONS.md) for deploy and webhook/cron setup.

Shared modules: `supabase/functions/_shared/`

| Module | Use |
|--------|-----|
| `supabase.ts` | `adminClient`, `requireUser`, CORS |
| `chapa.ts` | Chapa API + text sanitization |
| `finalize-payment.ts` | Idempotent payment finalize |
| `notifications.ts` | In-app + Expo push |

## TypeScript types

```bash
# After supabase link and db push:
npm run db:types
```

Generates `supabase/types/database.ts` and syncs to mobile + admin. Do not hand-edit the three copies independently.
