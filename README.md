# Sheger

Appointment booking platform for Ethiopia — mobile app for customers and web admin dashboard.

## Project structure

```
Sheger.com/                 ← monorepo root (single GitHub repo)
├── .github/workflows/      ← CI + database deploy
├── docs/DEPLOYMENT.md      ← Vercel, EAS, GitHub secrets
├── supabase/               ← migrations, seed, staging guide
├── sheger-mobile/          ← Expo (React Native) customer app
└── sheger-admin/           ← Next.js admin dashboard
```

## Branch

Use **`main`** only — all work is committed and pushed to `main`.

```bash
git checkout main
git push -u origin main
```

Set **main** as the default branch in GitHub repo settings.

## Quick start (local)

### Prerequisites

- Node.js 20+
- [Supabase](https://supabase.com/) account
- [Expo Go](https://expo.dev/go) (SDK 54) for mobile dev

### Supabase

1. Create **staging** and **production** projects — see [supabase/STAGING.md](supabase/STAGING.md)
2. Apply migrations:
   ```bash
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   npm run db:push
   npm run db:seed
   ```

### Environment variables

**Mobile** (`sheger-mobile/.env`):

```bash
cd sheger-mobile
cp .env.example .env
```

**Admin** (`sheger-admin/.env.local`):

```bash
cd sheger-admin
cp .env.example .env.local
```

Use **staging** credentials for daily development. Never commit `.env` files.

### Run apps

```bash
# Mobile
cd sheger-mobile && npm install && npm start

# Admin
cd sheger-admin && npm install && npm run dev
```

### CI locally

```bash
npm run ci
```

## Deployment

Full guide: **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

| Component | Platform | Trigger |
|-----------|----------|---------|
| Database | Supabase | Push to `main` (migrations) |
| Admin | Vercel | Push to `main` |
| Mobile | Expo EAS | `eas build` per profile |

### GitHub setup

```bash
git remote add origin https://github.com/YOUR_USER/sheger.git
git push -u origin main
```

### Required GitHub secrets

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_STAGING_PROJECT_REF`
- `SUPABASE_PRODUCTION_PROJECT_REF`

## Database schema

| Table | Purpose |
|-------|---------|
| `profiles` | Users (customer, business_owner, admin) |
| `categories` | Service types |
| `businesses` | Business listings |
| `services` | Services and pricing |
| `employees` | Staff |
| `working_hours` | Weekly schedule |
| `bookings` | Appointments |
| `reviews` | Ratings |

Types: `supabase/types/database.ts` (sync to both apps when schema changes).

## Mobile troubleshooting

- **Expo Go SDK mismatch:** Project uses Expo SDK 54
- **Android network errors:** Uses axios fetch workaround in `lib/network-fetch.ts`
- **Env placeholders:** Ensure `.env` has real values, then `npm run start:clear`

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for EAS builds and Vercel admin setup.
