# Deploying SPHERE

Three accounts, all free tier: Supabase (database + auth), Vercel (hosting),
and optionally Upstash (Redis). Budget about 30 minutes the first time.

Nothing here needs a credit card.

---

## 1. Supabase

### Create the project

1. Sign up at [supabase.com](https://supabase.com) and create a new project.
2. Pick a region near you and set a strong database password.
3. Wait for provisioning (about two minutes).

### Run the schema

Open **SQL Editor** and run these files in this exact order. Paste the contents
of each, run it, confirm it succeeds, then move to the next.

From `supabase/migrations/`:

1. `20260419154405_sphere_platform_schema.sql`
2. `20260419163245_fix_profiles_rls_recursion.sql`
3. `20260419191000_add_room_availability_rpc.sql`
4. `20260419194000_align_room_booking_statuses.sql`
5. `20260420001000_add_room_management_policies.sql`
6. `20260420014500_add_event_operator_keys_and_tickets.sql`
7. `20260420024000_event_head_access_policies.sql`
8. `20260420032500_fix_claim_event_ticket_function.sql`
9. `20260422223700_add_demo_account_guardrails.sql`
10. `20260425210600_fix_pgcrypto_search_path.sql`

Then from `supabase/manual/`:

11. `20260420_volunteer_gallery.sql`
12. `20260420_seed_reference_room_booking_rooms.sql`

Order matters. Later migrations drop and recreate policies from earlier ones,
so running them out of sequence leaves the wrong policies in place.

### Create the demo account

**Authentication → Users → Add user**

- Email: `demo@sphere.demo`
- Password: generate one and keep it, it goes into Vercel later
- Tick **Auto Confirm User**, otherwise sign-in fails on an unconfirmed email

### Seed the demo data

Now run `supabase/manual/20260422_seed_demo_data.sql`. It looks the demo user
up by email, so it has to run after the step above. It raises an error rather
than half-seeding if the user is missing.

It is safe to re-run; everything is keyed on stable titles.

### Copy your keys

**Project Settings → API**: copy the **Project URL** and the **anon public**
key. The anon key is meant to be public — row level security is what protects
the data, not the key.

---

## 2. Vercel

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New → Project**, import `Kanav-Midha/SPHERE`.
3. Framework preset should auto-detect as Vite. Leave the build settings alone,
   `vercel.json` already sets them.
4. Add these environment variables before the first deploy:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | your Project URL |
| `VITE_SUPABASE_ANON_KEY` | your anon public key |
| `VITE_DEMO_PASSWORD` | the demo account password |
| `VITE_ENABLE_GOOGLE_AUTH` | `false` for now — see below |
| `SUPABASE_URL` | same as `VITE_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | same as `VITE_SUPABASE_ANON_KEY` |

5. Deploy.

The demo button only appears when `VITE_DEMO_PASSWORD` is set, and the Google
button only when `VITE_ENABLE_GOOGLE_AUTH` is not `false`. With the values
above a visitor gets a single clear way in.

> Putting the demo password in a `VITE_` variable means it ships in the
> JavaScript bundle. That is intentional — it is a public demo account whose
> permissions are capped in the database. Never use a `VITE_` variable for the
> service role key or anything that actually needs protecting.

---

## 3. Google sign-in (optional)

Skip this and the demo still works. Do it when you want to sign in as yourself.

1. In Google Cloud Console create an OAuth 2.0 Client ID (Web application).
2. Authorised redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
3. In Supabase, **Authentication → Providers → Google**, paste the client ID
   and secret.
4. In Vercel, set `VITE_ENABLE_GOOGLE_AUTH` to `true` and
   `VITE_ALLOWED_GOOGLE_DOMAIN` to your campus domain.
5. **Authentication → URL Configuration**: set the Site URL to your Vercel URL,
   otherwise Google sends people back to localhost after sign-in.

To make yourself an admin after signing in once:

```sql
UPDATE profiles SET role = 'admin' WHERE email = 'you@goa.bits-pilani.ac.in';
```

---

## 4. Upstash Redis (optional)

Only the door scanner endpoints under `api/operator/` need this. Browsing,
booking and ticket claiming all work without it.

1. Create a free Redis database at [upstash.com](https://upstash.com).
2. Copy the **REST URL** and **REST token**.
3. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel and
   redeploy.

---

## Troubleshooting

**Blank page, console shows `supabaseUrl is required`** — the `VITE_` variables
were added after the build. Vite inlines them at build time, so redeploy.

**Demo button missing** — `VITE_DEMO_PASSWORD` is not set, or was set after the
last build.

**"Invalid login credentials" on the demo button** — the password in Vercel does
not match the one in Supabase, or the user was created without Auto Confirm.

**Demo user sees an empty app** — the seed did not run, or ran before the demo
user existed.

**Google sign-in returns to localhost** — Site URL is still the default under
Authentication → URL Configuration.

**"function gen_random_bytes(integer) does not exist" when claiming a ticket** —
migration 10 was skipped. Hosted Supabase keeps pgcrypto in the `extensions`
schema, and `claim_event_ticket` pins `search_path` to `public` alone.

**Everything reads empty but there are no errors** — you are signed in but your
profile row has the wrong role, or a migration was skipped. Check the SQL
Editor for the order in step 1.
