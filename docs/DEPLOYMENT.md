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

## Pre-push checklist

- [ ] `git status` shows no `.env` files
- [ ] `npm run ci` passes locally
- [ ] Migrations tested on staging before merging to `main`
