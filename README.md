# SPHERE

**Campus Event & Space Reservation Platform**

A role-based web platform for managing campus events, QR ticketing, and room
reservations. Built as my coursework project for **Database Management Systems
(DBMS)**, January – April 2026.

The interesting part of this project is not the UI — it is that almost every
access rule lives in the database rather than in application code. Roles,
row visibility, double-booking prevention, and ticket issuance are all enforced
by PostgreSQL constraints, row level security policies, and `SECURITY DEFINER`
functions. The React frontend holds no authorization logic it could be tricked
out of.

---

## What it does

**Students** browse campus events, claim a ticket (which generates a QR code),
browse bookable rooms with a live availability timeline, and submit room
reservation requests and volunteer applications.

**Event heads / admins** create events, review and approve or reject room
booking requests through a kanban board, manage the room inventory, and issue
operator access keys for their events.

**Operators** enter a short access key on the scanner page and validate ticket
QR codes at the door, with live scan metrics.

---

## Database design

### Tables

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users` with a role (`student`, `operator`, `admin`) |
| `events` | Campus events with capacity tracking and tag arrays |
| `rooms` | Bookable spaces with amenity lists |
| `bookings` | Room reservations, status lifecycle `pending → approved / rejected / cancelled` |
| `event_operator_keys` | One rotatable door-access key per event |
| `event_tickets` | Issued tickets, one per `(event_id, user_id)` |
| `scan_logs` | Ticket validation records, flushed from Redis in batches |
| `volunteer_events` | Application windows per event, UTC deadlines |
| `volunteer_applications` | Student applications, `pending → approved / rejected` |
| `volunteer_gallery_photos` | Photo uploads tied to a storage bucket |

### Constraints doing real work

Double-booking is not prevented by a "check if free, then insert" read in the
frontend — that race is exactly what a database is for. `bookings` carries a
`UNIQUE (room_id, date, time_slot)` constraint, so two students submitting the
same slot at the same moment means one insert simply fails at the database
level. `event_tickets` uses `UNIQUE (event_id, user_id)` the same way to make
double-claiming impossible, and a unique `ticket_hash` so a QR code cannot
collide.

### Row level security

RLS is enabled on every table. Students read and write only their own rows;
operators reach only scan-related data; admins get broad management access.

One problem worth writing down, because it cost me an evening: the first
version of the "admins can view all profiles" policy queried `profiles` from
inside a policy *on* `profiles`, which sends Postgres into infinite recursion.
The fix was a `SECURITY DEFINER` helper, `get_my_role()`, which reads the
caller's role without re-triggering RLS. Every later policy calls that instead
of subquerying the table. See
`supabase/migrations/20260419163245_fix_profiles_rls_recursion.sql`.

### Stored functions (RPCs)

Where a policy cannot express the rule, the logic sits in a function rather
than in the client:

- `get_my_role()` — RLS-safe role lookup
- `get_room_availability(room_id, date)` — exposes occupied slots for a room
  without exposing whose booking they are, which plain booking RLS cannot do
- `create_event_with_operator_key(...)` — creates an event and its door key atomically
- `verify_event_operator_key(key)` / `reset_event_operator_key(event_id)` — operator key checks and rotation
- `claim_event_ticket(event_id)` — issues a ticket and increments capacity in one transaction
- `process_event_scan(key, hash)` — validates a scanned ticket and records the scan
- `get_operator_scan_metrics(key)` — aggregate scan counts for the operator dashboard
- `generate_compact_access_key()` — 12-character key from an unambiguous alphabet
  (no `0/O`, no `1/I`), formatted `XXXX-XXXX-XXXX` so it can be read aloud

Schema changes are tracked as ordered migrations in `supabase/migrations/`, so
the database can be rebuilt from nothing. `supabase/manual/` holds seed data and
storage-bucket setup that is run once by hand.

---

## Tech stack

**Frontend** — React 18, TypeScript, Vite, Tailwind CSS, Zustand for state,
Framer Motion and GSAP for animation, React Three Fiber for the 3D hero,
`qrcode` and `jsQR` for ticket generation and scanning.

**Backend** — Supabase (PostgreSQL, Auth, Storage, RLS), serverless functions
under `api/`, Upstash Redis as a write buffer so the door scanner stays
responsive under a queue and scan rows land in Postgres in batches.

**Auth** — Supabase Google OAuth, optionally restricted to a single
institutional email domain.

---

## Project layout

```
api/                     serverless routes
  _lib/                  supabase, redis, and ticket helpers
  tickets/claim.js       ticket issuance
  operator/scan.js       ticket validation
  operator/metrics.js    live scan counts
src/
  components/modules/    feature panels (booking, events, scanner, volunteer)
  components/ui/         glass cards, magnetic buttons, nav, toasts
  components/3d/         ambient background and hero scenes
  lib/                   supabase client, booking and ticket logic
  store/                 zustand stores (auth, operator session, time, toast)
  pages/                 login, dashboard, scanner, volunteer
supabase/
  migrations/            ordered schema migrations
  manual/                seed data and storage setup
```

---

## Running it locally

```bash
git clone https://github.com/Kanav-Midha/SPHERE.git
cd SPHERE
npm install
cp .env.example .env     # then fill in your own values
npm run dev
```

Set up the database by running the files in `supabase/migrations/` in filename
order against your Supabase project, then the files in `supabase/manual/` for
seed rooms and the volunteer gallery bucket.

Enable Google as an auth provider in your Supabase dashboard. To promote your
own account to admin after first sign-in:

```sql
update profiles set role = 'admin' where email = 'you@example.edu';
```

Other scripts:

```bash
npm run build       # production build
npm run typecheck   # tsc, no emit
npm run lint        # eslint
```

---

## What I would change

The Redis buffer is the weakest link — if a flush fails, scan logs are lost
with no retry queue behind them. Availability is polled rather than pushed, so
two students on the booking page can briefly disagree about a slot until the
unique constraint settles it. And `capacity` / `registered` on `events` are
maintained by the claim function rather than derived from `event_tickets`,
which is a denormalization I took for read speed and would reconsider.

---

## License

MIT — see [LICENSE](LICENSE).

Built by **Kanav Midha**.
