# Supabase staging environment

Create a **second** Supabase project for staging (separate from production).

## 1. Create the project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Name: `sheger-staging` (or similar)
3. Save the database password in your password manager

## 2. Apply schema and seed

### CLI (recommended)

```bash
cd /path/to/Sheger.com
supabase login
supabase link --project-ref YOUR_STAGING_PROJECT_REF
npm run db:push
npm run db:seed
```

### SQL Editor (manual)

Run in order:

1. `supabase/migrations/20250611000001_initial_schema.sql`
2. `supabase/seed.sql`

## 3. Save credentials

From **Settings → API Keys**, store in your password manager:

| Variable | Staging value |
|----------|----------------|
| Project URL | `https://YOUR_STAGING_REF.supabase.co` |
| Publishable key | `sb_publishable_...` |
| Secret key | `sb_secret_...` (admin server only) |
| Project ref | Used for `supabase link` and GitHub Actions |

## 4. Wire into apps

**Local development (staging):**

- `sheger-mobile/.env` — staging URL + publishable key
- `sheger-admin/.env.local` — staging URL + publishable + secret keys

**CI / hosted deploys:**

- GitHub Actions secrets: `SUPABASE_STAGING_PROJECT_REF`, `SUPABASE_PRODUCTION_PROJECT_REF`
- Vercel: environment variables scoped to **Preview** (staging) vs **Production**
- EAS: secrets per build profile (`preview` = staging, `production` = prod)

## 5. Switch between environments locally

```bash
# Link CLI to staging
supabase link --project-ref YOUR_STAGING_PROJECT_REF

# Link CLI to production (careful)
supabase link --project-ref YOUR_PRODUCTION_PROJECT_REF
```

Never run `db:reset` against production.
