# Edge functions — deploy and schedules

Configure these on **each** Supabase project (staging + production).

Replace `YOUR_PROJECT_REF` with your project ref (e.g. `bukowczszrzgveilqnrr`).

## Deploy all functions

From repo root (after `supabase link`):

```bash
supabase functions deploy booking-notifications
supabase functions deploy send-booking-reminders
supabase functions deploy check-subscription-expiry
supabase functions deploy send-push-queue
supabase functions deploy expire-unpaid-bookings
supabase functions deploy chapa-initialize
supabase functions deploy chapa-verify
supabase functions deploy chapa-cancel
supabase functions deploy chapa-webhook
supabase functions deploy chapa-return
```

Or deploy individually as needed.

## Secrets

```bash
supabase secrets set CHAPA_SECRET_KEY=CHASECK_TEST-...
supabase secrets set CHAPA_WEBHOOK_SECRET=your-webhook-hash
supabase secrets set CHAPA_MODE=test
```

## JWT verification (`supabase/config.toml`)

| Function | `verify_jwt` | Why |
|----------|--------------|-----|
| `chapa-initialize`, `chapa-verify`, `chapa-cancel` | default (true) | User JWT required |
| `booking-notifications` | false | Database webhook |
| `send-booking-reminders` | false | Cron |
| `check-subscription-expiry` | false | Cron |
| `send-push-queue` | false | Cron/worker |
| `expire-unpaid-bookings` | false | Cron |
| `chapa-webhook` | false | Chapa HMAC signature |
| `chapa-return` | false | Browser redirect (GET) |

Dashboard deploy: use `--no-verify-jwt` for functions marked false above.

## Database webhook

**Dashboard → Database → Webhooks → Create**

| Field | Value |
|-------|--------|
| Name | `booking-notifications` |
| Table | `bookings` |
| Events | `INSERT`, `UPDATE` |
| Type | Supabase Edge Function |
| Function | `booking-notifications` |

## Cron schedules

**Dashboard → Edge Functions → [function] → Schedules** (or pg_cron + `net.http_post`).

| Function | Suggested cron | Purpose |
|----------|----------------|---------|
| `send-booking-reminders` | `*/15 * * * *` | 24h and 1h booking reminders |
| `check-subscription-expiry` | `0 */6 * * *` | Mark expired subscriptions `past_due` |
| `send-push-queue` | `* * * * *` | Flush queued Expo push deliveries |
| `expire-unpaid-bookings` | `*/5 * * * *` | Cancel bookings with unpaid Chapa checkout (15 min hold) |

### HTTP invoke URL (for external cron)

```
POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-booking-reminders
POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-subscription-expiry
POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-push-queue
POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/expire-unpaid-bookings
```

No `Authorization` header required when `verify_jwt` is false.

## Chapa

| Setting | Value |
|---------|--------|
| Webhook URL | `https://YOUR_PROJECT_REF.supabase.co/functions/v1/chapa-webhook` |
| Return URL (Chapa API, HTTPS only) | `https://YOUR_PROJECT_REF.supabase.co/functions/v1/chapa-return?tx_ref=…` |
| After redirect | `chapa-return` sends the user to `sheger://payment/return?tx_ref=…` |

Webhook secret must match `CHAPA_WEBHOOK_SECRET`.

## Checklist (new environment)

- [ ] `supabase db push` (all migrations)
- [ ] Edge function secrets set
- [ ] All functions deployed
- [ ] Database webhook on `bookings`
- [ ] Cron schedules for reminders, push queue, subscription expiry, unpaid bookings
- [ ] Chapa webhook URL + secret (test or live)
