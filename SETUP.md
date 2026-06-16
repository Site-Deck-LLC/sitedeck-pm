⚠️ OUTDATED — This setup guide was written for the Supabase era. PM now runs on a self-hosted Postgres container on the VPS. See MIGRATION_PM_TO_VPS.md for the current architecture. This file is preserved for historical reference only.

# SiteDeck PM — Setup & Deploy

## Step 1: Create a free database (5 minutes)

1. Go to [supabase.com](https://supabase.com) → Sign up → New Project
2. Choose Postgres 16, any region
3. In Project Settings → Database → copy the **Connection string** (URI tab)
4. It looks like: `postgresql://postgres:password@db.xxx.supabase.co:5432/postgres`

## Step 2: Configure the app

```bash
cp .env.example .env
```

Paste your Supabase connection string into `.env`:

```env
DATABASE_URL=postgresql://postgres:your-password@db.xxx.supabase.co:5432/postgres
```

## Step 3: Create tables & seed data

```bash
npx prisma migrate dev
npx prisma db seed
```

## Step 4: Start the server

```bash
npm run dev
```

Server runs at `http://localhost:3000`.

## Step 5: Test it

```bash
# Health check (no auth)
curl http://localhost:3000/api/v1/health

# List projects (uses dev auth bypass — no Firebase needed)
curl http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer dev-token"
```

The `dev-token` bypass lets you test every route locally without setting up Firebase.

## Step 6: Deploy to Vercel

1. **Push this repo to GitHub** (if you haven't already)
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. In Project Settings → Environment Variables, add:
   - `DATABASE_URL` → your Supabase connection string
4. **Deploy.** Vercel will run `npm run build` automatically.
5. After first deploy, run the production migration:
   ```bash
   npx prisma migrate deploy
   ```
   (Run this once from your machine against the same database.)

## That's it

| What | Where |
|------|-------|
| Local API | `http://localhost:3000` |
| Production API | `https://your-project.vercel.app` |
| Database | Supabase (free tier) |
| Auth (local) | `dev-token` bypass |
| Auth (production) | Firebase Auth (set up later when you need real users) |

## Useful commands

```bash
npm run dev          # local server
npm test             # run all tests
npm run build        # compile for production
npx prisma studio    # open database GUI
```
