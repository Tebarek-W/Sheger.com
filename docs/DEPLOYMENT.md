# Sheger deployment guide

Monorepo with **staging** and **production** environments.

## Repository

- **One GitHub repo** at the project root (`Sheger.com/`)
- **Branches:** `staging` (default integration) → `main` (production)
- **Workflow:** `feature/*` → PR to `staging` → PR to `main`

## GitHub secrets (Settings → Secrets and variables → Actions)

| Secret | Used for |
|--------|----------|
| `SUPABASE_ACCESS_TOKEN` | Personal access token from [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_STAGING_PROJECT_REF` | Staging project ref (subdomain prefix) |
| `SUPABASE_PRODUCTION_PROJECT_REF` | Production project ref |

Create GitHub **environments** named `staging` and `production` (optional; used by `deploy-db.yml`).

## Supabase

| Branch | Database |
|--------|----------|
| `staging` | Staging Supabase project |
| `main` | Production Supabase project |

- Migrations: `supabase/migrations/`
- Auto-deploy: `.github/workflows/deploy-db.yml` on push when migrations change
- Manual: see [supabase/STAGING.md](../supabase/STAGING.md)

## Admin (Vercel)

1. Import the GitHub repo at [vercel.com/new](https://vercel.com/new)
2. **Root Directory:** `sheger-admin`
3. **Production Branch:** `main`
4. Enable deployments for `staging` branch (preview/staging URL)

### Vercel environment variables

| Variable | Preview (staging) | Production |
|----------|-------------------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Staging URL | Production URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Staging publishable key | Production publishable key |
| `SUPABASE_SECRET_KEY` | Staging secret key | Production secret key |

Legacy names `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SERVICE_ROLE_KEY` also work.

## Mobile (Expo EAS)

1. Install EAS CLI: `npm install -g eas-cli`
2. Login: `eas login`
3. From `sheger-mobile/`:

```bash
cd sheger-mobile
eas init
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR_REF.supabase.co" --type string
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "sb_publishable_..." --type string
```

4. Set secrets per environment in [expo.dev](https://expo.dev) → Project → Environment variables:
   - **development** / **preview** → staging Supabase
   - **production** → production Supabase

### Build commands

```bash
# Staging / internal test APK
eas build --profile preview --platform android

# Production store build
eas build --profile production --platform android
```

Profiles are defined in [sheger-mobile/eas.json](../sheger-mobile/eas.json).

### Push notifications (FCM / APNs)

Push uses **Expo Notifications** with tokens stored in `push_tokens`. In-app messages live in `notifications`.

1. Run `eas init` in `sheger-mobile/` if you have not already (creates the Expo project ID used for push tokens).
2. In [expo.dev](https://expo.dev) → Project → **Credentials**:
   - **Android:** upload or generate an FCM v1 service account key.
   - **iOS:** configure APNs (key or certificate) for bundle ID `com.sheger.app`.
3. Build a **development client** or store build — Expo Go has limited push support on Android:

```bash
cd sheger-mobile
eas build --profile development --platform android
# or preview / production profiles
```

4. Apply migration `supabase/migrations/20250623000001_notifications.sql` on your Supabase project.

5. Deploy Edge Functions:

```bash
supabase functions deploy booking-notifications --no-verify-jwt
supabase functions deploy send-booking-reminders --no-verify-jwt
```

`--no-verify-jwt` is required for Database Webhooks and scheduled invocations (they do not send a user JWT).

6. **Database Webhook** (Supabase Dashboard → Database → Webhooks):
   - Table: `bookings`
   - Events: `INSERT`, `UPDATE`
   - Type: Supabase Edge Function
   - Function: `booking-notifications`

7. **Reminder cron** (Supabase Dashboard → Edge Functions → `send-booking-reminders` → Schedules, or Cron extension):
   - Schedule: `*/15 * * * *` (every 15 minutes)
   - Sends 24h and 1h reminders for `confirmed` bookings (Africa/Addis_Ababa formatting on the server).

8. Test on a **physical device** with notification permission granted. Denied permission still allows the in-app inbox.

## Provider subscriptions (mock payment)

Providers choose a **subscription plan** (Free, Basic, Premium, etc.) to stay visible on the marketplace. Admins create plans and set limits; businesses pick a plan and inherit those limits automatically.

### 1. Apply migrations

```bash
supabase db push
```

Required file:

- `supabase/migrations/20250625000001_business_subscriptions.sql` (plans, marketplace gating, featured search)

Or run it in the Supabase SQL Editor.

If you previously applied the older split migrations (`20250626000001`–`20250628000001`), mark them as reverted locally so `db push` stays in sync:

```bash
supabase migration repair 20250626000001 --status reverted
supabase migration repair 20250627000001 --status reverted
supabase migration repair 20250627000002 --status reverted
supabase migration repair 20250628000001 --status reverted
```

### 2. Admin configuration

In the admin panel, open **Subscription plans** (`/dashboard/plans`):

- Create/edit plans (name, monthly/yearly fee, max services, max bookings per week)
- Hide or delete unused plans (cannot delete plans in use)

Default seeded plans: **Free** (0 ETB), **Basic** (500/5000 ETB), **Premium** (1500/15000 ETB).

### 3. Owner app

Owners use **Subscription & billing** on the dashboard:

1. Pick a plan (Free, Basic, Premium, …)
2. For paid plans: choose monthly/yearly + mock payment method
3. For free plans: tap **Activate plan** (no payment)

Limits update immediately from the selected plan.

### 4. Expiry cron (optional)

Deploy and schedule the expiry checker:

```bash
supabase functions deploy check-subscription-expiry --no-verify-jwt
```

Schedule: `0 */6 * * *` (every 6 hours). Marks expired `active` subscriptions as `past_due` and sets `grace_ends_at`.

### 5. Marketplace gating

- Customers only see businesses with an active paid period (`business_is_marketplace_live`)
- Booking inserts are rejected when subscription expired or weekly booking cap reached
- Service activation is blocked when max active services reached

## Pre-push checklist

- [ ] `git status` shows no `.env` files
- [ ] `npm run ci` passes locally
- [ ] Migrations tested on staging before merging to `main`
