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

## Pre-push checklist

- [ ] `git status` shows no `.env` files
- [ ] `npm run ci` passes locally
- [ ] Migrations tested on staging before merging to `main`
