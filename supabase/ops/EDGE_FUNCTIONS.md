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
supabase functions deploy chapa-callback
supabase functions deploy chapa-webhook
supabase functions deploy chapa-return
supabase functions deploy chapa-banks
supabase functions deploy chapa-subaccount
supabase functions deploy chapa-charge
supabase functions deploy chapa-authorize
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
| `chapa-banks`, `chapa-subaccount` | default (true) | Owner JWT for payout setup |
| `chapa-charge`, `chapa-authorize` | default (true) | Customer JWT for direct charge checkout |
| `booking-notifications` | false | Database webhook |
| `send-booking-reminders` | false | Cron |
| `check-subscription-expiry` | false | Cron |
| `send-push-queue` | false | Cron/worker |
| `expire-unpaid-bookings` | false | Cron |
| `chapa-webhook` | false | Chapa dashboard webhook (POST + HMAC) |
| `chapa-callback` | false | Chapa initialize `callback_url` (GET + server verify) |
| `chapa-return` | false | Browser redirect after payment (GET) |

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

Per [Accept Payment](https://developer.chapa.co/integrations/accept-payments) and [Verify Payment](https://developer.chapa.co/integrations/verify-payments):

| Role | URL | Method | Handler |
|------|-----|--------|---------|
| `callback_url` (in initialize) | `https://YOUR_PROJECT_REF.supabase.co/functions/v1/chapa-callback` | GET | Server verifies via Chapa API, then finalizes booking |
| `return_url` (in initialize) | `https://YOUR_PROJECT_REF.supabase.co/functions/v1/chapa-return?tx_ref=…` | GET | Redirects user back to the app |
| Dashboard webhook | `https://YOUR_PROJECT_REF.supabase.co/functions/v1/chapa-webhook` | POST | `charge.success` events; re-verifies via API (idempotent) |
| Mobile confirm | `chapa-verify` edge function | POST | Client-triggered verify after browser return |
| User / cron cancel | `chapa-cancel` + `expire-unpaid-bookings` | POST | `PUT` cancel on Chapa API to expire checkout links |

### Verify ([docs](https://developer.chapa.co/integrations/verify-payments))

All finalize paths call `GET https://api.chapa.co/v1/transaction/verify/<tx_ref>` server-side before marking a booking paid.

### Cancel ([docs](https://developer.chapa.co/integrations/transaction-cancel))

`chapa-cancel` and `expire-unpaid-bookings` call `PUT https://api.chapa.co/v1/transaction/cancel/<tx_ref>` for active transactions before updating Sheger records.

Webhook secret in the Chapa dashboard must match `CHAPA_WEBHOOK_SECRET`.

### Split payments ([docs](https://developer.chapa.co/integrations/split-payment))

| Step | Who | What |
|------|-----|------|
| 1 | Business owner | `chapa-banks` → pick bank; `chapa-subaccount` creates Chapa subaccount + saves `business_chapa_subaccounts` |
| 2 | Customer checkout | `chapa-initialize` attaches `subaccounts` with plan commission rate; platform keeps commission, vendor bank gets the rest |
| 3 | Verify / webhook | `finalize_chapa_payment` records `booking_financials` (commission + owner net) |

Online Chapa checkout is blocked (`payout_not_configured`) until the business has an active payout account.

### Accept Payment (hosted checkout — customer mobile)

Per [Accept Payment](https://developer.chapa.co/integrations/accept-payments):

| Step | Where | What happens |
|------|-------|----------------|
| 1 | Sheger payment screen | Customer selects Chapa and confirms booking |
| 2 | `chapa-initialize` | Server calls `POST /v1/transaction/initialize`, stores `payment_transactions`, returns `checkout_url` |
| 3 | Checkout screen | App redirects customer to `checkout_url` (Chapa-hosted UI via in-app browser) |
| 4 | Chapa | Customer picks Telebirr, CBE Birr, cards, etc. on Chapa's page |
| 5 | `chapa-return` | Chapa redirects to HTTPS return URL → deep link back to app |
| 6 | `chapa-verify` | App/server verifies via Chapa API before marking booking paid |

The payment method UI is **hosted by Chapa**, not recreated in Sheger. In **test mode**, Chapa's hosted page may show a simplified **Pay with Test Mode** button; the full method list appears in **live mode**.

`chapa-charge` / `chapa-authorize` (Direct Charge) remain deployed for optional future use but are not the default customer path.

## Checklist (new environment)

- [ ] `supabase db push` (all migrations)
- [ ] Edge function secrets set
- [ ] All functions deployed
- [ ] Database webhook on `bookings`
- [ ] Cron schedules for reminders, push queue, subscription expiry, unpaid bookings
- [ ] Chapa webhook URL + secret (test or live)
