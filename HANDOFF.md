# Sheger — Client handoff guide

This document explains how to take ownership of the Sheger codebase and deploy it to your own infrastructure. The developer delivers **source code and documentation**; you create and manage all hosting accounts, secrets, and production services.

## What you are receiving

| Component | Path | Description |
|-----------|------|-------------|
| Mobile app | `sheger-mobile/` | Expo (React Native) customer + business owner app |
| Admin dashboard | `sheger-admin/` | Next.js web admin |
| Backend | `supabase/` | PostgreSQL schema, RPCs, Edge Functions (Chapa, notifications) |
| CI | `.github/workflows/ci.yml` | Typecheck + admin build (no Supabase secrets required) |
| DB deploy (optional) | `.github/workflows/deploy-db.yml` | Auto `db push` when secrets are configured |

**Not included:** Supabase projects, Vercel, Expo/EAS, Chapa merchant accounts, app store listings, or any credentials from the original developer.

---

## Accounts you must create

1. **Supabase** — staging + production projects ([supabase.com](https://supabase.com))
2. **GitHub** — repository ownership (transfer or new org repo)
3. **Vercel** — admin dashboard hosting ([vercel.com](https://vercel.com))
4. **Expo / EAS** — mobile builds ([expo.dev](https://expo.dev))
5. **Chapa** — online payments ([dashboard.chapa.co](https://dashboard.chapa.co))
6. **App stores** (optional) — Google Play / Apple App Store when going live

---

## Repository structure

```
Sheger.com/
├── sheger-mobile/       ← Expo app
├── sheger-admin/        ← Next.js admin
├── supabase/            ← migrations, functions, seed
├── docs/DEPLOYMENT.md   ← full-stack deploy reference
├── supabase/STAGING.md
├── supabase/ops/EDGE_FUNCTIONS.md
└── HANDOFF.md           ← this file
```

---

## Part 1 — Backend deployment (Supabase)

Do this **once per environment** (staging first, then production).

### Prerequisites

- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- Node.js 20+
- Repo cloned locally

```bash
cd /path/to/Sheger.com
supabase login
```

### Step 1 — Create a Supabase project

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Save the **database password**
3. From **Settings → General**, copy the **Project ref** (subdomain in `https://YOUR_REF.supabase.co`)
4. From **Settings → API Keys**, save:
   - Project URL
   - Publishable (anon) key — safe for mobile/admin client
   - Secret (service role) key — **server only**, never in the mobile app

### Step 2 — Link the CLI

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

### Step 3 — Apply database migrations

```bash
npm run db:push
# or: supabase db push
```

Confirm when prompted. This applies all files in `supabase/migrations/`.

**Optional demo data (staging only):**

```bash
npm run db:seed
```

**Regenerate TypeScript types (for development):**

```bash
npm run db:types
```

Never run `npm run db:reset` against production.

### Step 4 — Set Edge Function secrets

Required for Chapa payments:

```bash
supabase secrets set CHAPA_SECRET_KEY=CHASECK_TEST-your-key
supabase secrets set CHAPA_WEBHOOK_SECRET=your-webhook-hash
supabase secrets set CHAPA_MODE=test
```

For **live** payments (after Chapa approval):

```bash
supabase secrets set CHAPA_SECRET_KEY=CHASECK_LIVE-your-key
supabase secrets set CHAPA_MODE=live
```

See `supabase/.env.example` for reference. Set secrets on **each** Supabase project (staging and production separately).

### Step 5 — Deploy Edge Functions

From repo root (after `supabase link`):

**Chapa / payments:**

```bash
supabase functions deploy chapa-initialize
supabase functions deploy chapa-subscription-initialize
supabase functions deploy chapa-verify
supabase functions deploy chapa-cancel
supabase functions deploy chapa-callback --no-verify-jwt
supabase functions deploy chapa-webhook --no-verify-jwt
supabase functions deploy chapa-return --no-verify-jwt
supabase functions deploy chapa-banks
supabase functions deploy chapa-subaccount
supabase functions deploy delete-account
```

**Notifications & background jobs:**

```bash
supabase functions deploy booking-notifications --no-verify-jwt
supabase functions deploy send-booking-reminders --no-verify-jwt
supabase functions deploy send-push-queue --no-verify-jwt
supabase functions deploy check-subscription-expiry --no-verify-jwt
supabase functions deploy expire-unpaid-bookings --no-verify-jwt
```

Legacy Direct Charge (`chapa-charge`, `chapa-authorize`) is unused by the apps — skip unless you revive that path.

Full reference: `supabase/ops/EDGE_FUNCTIONS.md`

### Step 6 — Supabase Dashboard configuration

#### A. Database webhook (booking notifications)

**Database → Webhooks → Create**

| Field | Value |
|-------|--------|
| Table | `bookings` |
| Events | `INSERT`, `UPDATE` |
| Type | Edge Function |
| Function | `booking-notifications` |

#### B. Cron schedules

**Edge Functions → [function] → Schedules**

| Function | Cron | Purpose |
|----------|------|---------|
| `send-booking-reminders` | `*/15 * * * *` | 24h and 1h booking reminders |
| `expire-unpaid-bookings` | `*/5 * * * *` | Cancel stale Chapa checkouts |
| `check-subscription-expiry` | `0 */6 * * *` | Subscription grace / expiry |
| `send-push-queue` | `* * * * *` | Flush Expo push queue |

#### C. Chapa dashboard

Set webhook URL to:

```
https://YOUR_PROJECT_REF.supabase.co/functions/v1/chapa-webhook
```

The webhook secret must match `CHAPA_WEBHOOK_SECRET`. Callback and return URLs are handled by the deployed edge functions.

### Step 7 — Verify backend

- [ ] Tables visible in **Table Editor** (`businesses`, `bookings`, `payment_transactions`, …)
- [ ] Edge Functions show as deployed with no errors in logs
- [ ] Test Chapa checkout on **staging** with test keys before going live
- [ ] Create an admin user and approve a test business end-to-end

### Step 8 — Production

Repeat Steps 1–7 with a **separate** Supabase project and **live** Chapa keys.

---

## Part 2 — Connect mobile and admin apps

After backend is live, point the frontends at your Supabase project.

### Mobile (`sheger-mobile/`)

```bash
cd sheger-mobile
cp .env.example .env
```

| Variable | Value |
|----------|--------|
| `EXPO_PUBLIC_SUPABASE_URL` | `https://YOUR_REF.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Publishable key from Supabase |

```bash
npm install
npm start
```

**EAS builds:** see `docs/DEPLOYMENT.md` — set the same variables in Expo project secrets per environment (preview = staging, production = live).

### Admin (`sheger-admin/`)

```bash
cd sheger-admin
cp .env.example .env.local
```

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key |
| `SUPABASE_SECRET_KEY` | Secret key (server only) |

```bash
npm install
npm run dev
```

**Vercel:** import repo, set **Root Directory** to `sheger-admin`, add env vars for Preview (staging) and Production. See `docs/DEPLOYMENT.md`.

---

## Part 3 — Optional GitHub Actions (auto migrations)

The **Deploy Database** workflow (`.github/workflows/deploy-db.yml`) runs `supabase db push` when migration files change. It is **skipped** until secrets exist.

Add in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Source |
|--------|--------|
| `SUPABASE_ACCESS_TOKEN` | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_STAGING_PROJECT_REF` | Staging project ref |
| `SUPABASE_PRODUCTION_PROJECT_REF` | Production project ref |

Edge Functions are **not** auto-deployed by this workflow — deploy them manually with `supabase functions deploy` (or add your own CI job).

---

## Backend checklist (copy per environment)

- [ ] Supabase project created
- [ ] `supabase link --project-ref …`
- [ ] `npm run db:push`
- [ ] Chapa secrets set (`CHAPA_SECRET_KEY`, `CHAPA_WEBHOOK_SECRET`, `CHAPA_MODE`)
- [ ] All edge functions deployed
- [ ] Database webhook on `bookings`
- [ ] Cron schedules configured
- [ ] Chapa webhook URL + secret configured
- [ ] Mobile + admin env vars updated
- [ ] End-to-end test: register → book → pay (test mode) → confirm

---

## Key product behaviour (for QA)

| Flow | Behaviour |
|------|-----------|
| **Chapa booking** | Booking row is created **after** payment is verified, not before |
| **Cash booking** | Booking is created immediately on confirm |
| **Double booking** | Server enforces slot capacity, staff conflicts, and duplicate customer slots |
| **Online pay** | Requires business Chapa subaccount (owner sets payout in app) |
| **Subscriptions** | Businesses need an active plan to appear on marketplace |

Chapa **test mode** uses `CHAPA_MODE=test` and test secret keys. Switch to live only after Chapa merchant approval.

---

## Local development quick start

```bash
# Backend (linked to staging)
supabase link --project-ref YOUR_STAGING_REF
npm run db:push

# Mobile
cd sheger-mobile && cp .env.example .env && npm install && npm start

# Admin
cd sheger-admin && cp .env.example .env.local && npm install && npm run dev

# CI locally
npm run ci
```

---

## Further reading

| Document | Contents |
|----------|----------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Full deploy: Vercel, EAS, subscriptions, notifications |
| [supabase/STAGING.md](supabase/STAGING.md) | Staging project setup |
| [supabase/ops/EDGE_FUNCTIONS.md](supabase/ops/EDGE_FUNCTIONS.md) | Functions, JWT flags, Chapa URLs |
| [supabase/BACKEND.md](supabase/BACKEND.md) | Schema and RPC conventions |
| [README.md](README.md) | Repo overview |

---

## Security reminders

- Never commit `.env`, `.env.local`, or API keys to git
- Never put the Supabase **secret** key in the mobile app
- Use staging for all testing; use production keys only when going live
- Rotate Chapa and Supabase tokens if they were ever shared insecurely

---

## Suggested handoff from developer

The developer should provide:

1. This repository (transfer or push to your GitHub org)
2. A short demo or walkthrough call (optional)
3. Confirmation that `npm run ci` passes on `main`
4. List of any known open items or post-launch tasks

You provide all cloud accounts, secrets, app store accounts, and ongoing hosting costs.
