# Gym App API

Node.js backend for the gym app: a **modular monolith** on **Supabase**.
Members check in, train, book classes, post and shop; coaches run their profile and validate records; the club admin runs everything.

- **Stack:** Node 22+, TypeScript, Fastify 5, Zod 4, Drizzle ORM, Supabase (Auth, Postgres, Storage, Realtime)
- **Design:** ten modules under `src/modules/`, each owning its own tables and exposing a public `index.ts`. `test/architecture.test.ts` fails if a module reaches into another's internals.
- **Docs:** OpenAPI at `/docs` once running.

## Run it locally

1. **Create a Supabase project** (free) at supabase.com.
2. **Create the database.** In Supabase → SQL Editor, paste and run `../supabase/migrations/20260924000000_backend_schema.sql`. Or, with the Supabase CLI, run `supabase db push`.
3. **Configure.** Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and a long random `SETUP_TOKEN`.
4. **Start.**
   ```bash
   npm install
   npm run dev        # http://localhost:4000, docs at /docs
   ```

## Create the first club and admin

Sign up a user with Supabase Auth, from the app or from Supabase → Authentication → Add user. Then call this with that user's access token:

```http
POST /v1/setup
Authorization: Bearer <access token>

{ "setupToken": "<SETUP_TOKEN>", "gym": { "name": "Olympe Fitness", "slug": "olympe", "city": "Sousse" },
  "owner": { "fullName": "Karim", "whatsapp": "21620000001" } }
```

Members then join with `POST /v1/onboarding { "gymSlug": "olympe", ... }`. The door QR code is on `GET /v1/gym`, which only the admin can see.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start with auto-reload |
| `npm test` | Domain, API and architecture tests on an in-memory Postgres (PGlite): no Docker, no Supabase needed |
| `npm run typecheck` | TypeScript check |
| `npm run build` then `npm start` | Production build and run |

## Layout

```
src/
  main.ts            boot: env → db → app → listen → jobs
  app.ts             composition root: wires modules, plugins, error handling
  config/env.ts      validated environment
  shared/            db client + schema, auth (JWT, actor, guards), event bus, errors, time
  modules/<name>/    routes.ts → service.ts → repository.ts, index.ts = public API
  jobs/              close stale check-ins (10 min), membership reminders (09:00 Tunis)
test/                domain.test.ts · api.test.ts · architecture.test.ts
```

## Rules worth knowing

- **Money** is integer millimes (1 TND = 1000).
- **Days** such as streaks, bookings and journal days use the gym's timezone, not UTC.
- **Roles:** `member`, `coach` (set when the admin approves an application), `owner` (the admin). Staff are members with grants: `manage_classes`, `manage_products`, `manage_announcements`, `manage_coaches`, `validate_records`.
- **Writes** all go through this API. The app uses Supabase directly only to sign in, upload images to signed URLs (`POST /v1/uploads/sign`) and subscribe to Realtime (`check_ins`, `notifications`).
- **Jobs:** set `JOBS_ENABLED=true` on exactly one instance.
