/*
  SPHERE — one-shot database setup

  Generated from the files in supabase/migrations/ and supabase/manual/,
  concatenated in the order they must run. Paste this whole file into the
  Supabase SQL Editor and run it once.

  It does NOT include the demo seed data. Run supabase/manual/20260422_seed_demo_data.sql
  afterwards, once the demo@sphere.demo user exists in Authentication -> Users.

  The individual files remain the source of truth; this is a convenience copy.
*/


-- ============================================================
-- 20260419154405_sphere_platform_schema.sql
-- ============================================================
/*
  # SPHERE Platform - Full Schema Migration

  ## Overview
  Complete database schema for the SPHERE Campus Event & Space Reservation Platform.

  ## New Tables

  ### profiles
  - Extends auth.users with role-based access control
  - Roles: student, operator, admin
  - Stores display name and avatar

  ### events
  - Campus events with metadata, capacity tracking, and image URLs
  - Supports JSONB tags for AI metadata

  ### rooms
  - Bookable campus spaces with amenity listings

  ### bookings
  - Room reservations with strict UNIQUE constraint on (room_id, date, time_slot)
  - This enforces concurrency safety at the database level

  ### volunteer_events
  - Defines volunteer application windows per event (UTC-based deadlines)

  ### volunteer_applications
  - Student applications for volunteer roles
  - Status lifecycle: pending -> approved/rejected

  ### scan_logs
  - QR ticket validation records (batched from Redis)

  ## Security
  - RLS enabled on all tables
  - Students can only read/write their own data
  - Operators can only access scan-related data
  - Admins have broad access for management
*/

-- PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'operator', 'admin')),
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- EVENTS
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  venue text DEFAULT '',
  event_date timestamptz NOT NULL,
  capacity int DEFAULT 100,
  registered int DEFAULT 0,
  image_url text DEFAULT '',
  tags text[] DEFAULT '{}',
  organizer_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view events"
  ON events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert events"
  ON events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ROOMS
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity int DEFAULT 30,
  location text DEFAULT '',
  amenities text[] DEFAULT '{}',
  available bool DEFAULT true
);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view rooms"
  ON rooms FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage rooms"
  ON rooms FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'operator'))
  );

-- BOOKINGS
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  date date NOT NULL,
  time_slot text NOT NULL,
  purpose text DEFAULT '',
  status text DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'pending')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(room_id, date, time_slot)
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookings"
  ON bookings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- VOLUNTEER EVENTS
CREATE TABLE IF NOT EXISTS volunteer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id),
  title text NOT NULL,
  description text DEFAULT '',
  application_open timestamptz NOT NULL,
  application_close timestamptz NOT NULL,
  spots int DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE volunteer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view volunteer events"
  ON volunteer_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage volunteer events"
  ON volunteer_events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- VOLUNTEER APPLICATIONS
CREATE TABLE IF NOT EXISTS volunteer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  volunteer_event_id uuid REFERENCES volunteer_events(id) NOT NULL,
  user_id uuid REFERENCES profiles(id) NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  motivation text DEFAULT '',
  skills text[] DEFAULT '{}',
  experience text DEFAULT '',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  applied_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(volunteer_event_id, user_id)
);

ALTER TABLE volunteer_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own applications"
  ON volunteer_applications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Students can insert applications"
  ON volunteer_applications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all applications"
  ON volunteer_applications FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Admins can update application status"
  ON volunteer_applications FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- SCAN LOGS
CREATE TABLE IF NOT EXISTS scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_hash text NOT NULL,
  event_id uuid REFERENCES events(id),
  operator_id uuid REFERENCES profiles(id),
  status text CHECK (status IN ('valid', 'invalid', 'already_scanned')),
  scanned_at timestamptz DEFAULT now()
);

ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can insert scan logs"
  ON scan_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('operator', 'admin'))
  );

CREATE POLICY "Admins can view all scan logs"
  ON scan_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "Operators can view own scan logs"
  ON scan_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = operator_id);

-- SEED DATA: Rooms
INSERT INTO rooms (name, capacity, location, amenities) VALUES
  ('LT-1', 120, 'Academic Block A, Ground Floor', ARRAY['Projector', 'Audio System', 'AC', 'Recording Equipment']),
  ('LT-2', 80, 'Academic Block A, First Floor', ARRAY['Projector', 'Audio System', 'AC']),
  ('Seminar Hall 3', 50, 'Academic Block B, Ground Floor', ARRAY['Smart Board', 'AC', 'Video Conferencing']),
  ('Innovation Lab', 30, 'Tech Hub, Second Floor', ARRAY['Workstations', '3D Printers', 'AC', 'Whiteboard']),
  ('Boardroom A', 20, 'Admin Block, Third Floor', ARRAY['TV Display', 'Conference Phone', 'AC', 'Whiteboard']),
  ('Open Auditorium', 500, 'Central Campus', ARRAY['Stage', 'Sound System', 'Lighting Rig', 'Backstage'])
ON CONFLICT DO NOTHING;


-- ============================================================
-- 20260419163245_fix_profiles_rls_recursion.sql
-- ============================================================
/*
  # Fix infinite recursion in profiles RLS

  ## Problem
  The "Admins can view all profiles" policy queries the profiles table
  inside a policy on the profiles table, causing infinite recursion.

  ## Fix
  Drop the recursive admin policy. Use a security-definer function
  to check role without triggering RLS recursion.
*/

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'admin'
  );


-- ============================================================
-- 20260419191000_add_room_availability_rpc.sql
-- ============================================================
/*
  # Add room availability RPC

  ## Why
  Students need to see occupied time slots for a room before booking.
  Existing booking RLS only exposes a student's own rows, so the frontend
  cannot safely render availability without a scoped RPC.
*/

CREATE OR REPLACE FUNCTION public.get_room_availability(target_room_id uuid, target_date date)
RETURNS TABLE (
  time_slot text,
  status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.time_slot, b.status
  FROM bookings b
  WHERE b.room_id = target_room_id
    AND b.date = target_date
    AND b.status IN ('approved', 'pending')
  ORDER BY b.time_slot;
$$;

REVOKE ALL ON FUNCTION public.get_room_availability(uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_room_availability(uuid, date) TO authenticated;


-- ============================================================
-- 20260419194000_align_room_booking_statuses.sql
-- ============================================================
/*
  # Align room booking statuses with approval flow

  ## Changes
  - move existing confirmed bookings to approved
  - expand booking status lifecycle for room requests
  - allow admins to review and update room booking requests
*/

UPDATE bookings
SET status = 'approved'
WHERE status = 'confirmed';

ALTER TABLE bookings
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE bookings
  ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

DROP POLICY IF EXISTS "Users can update own bookings" ON bookings;

CREATE POLICY "Users can update own bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update all bookings" ON bookings;

CREATE POLICY "Admins can update all bookings"
  ON bookings FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');


-- ============================================================
-- 20260420001000_add_room_management_policies.sql
-- ============================================================
/*
  # Add room management policies

  ## Why
  The admin room-management UI needs update and delete access on rooms.
*/

DROP POLICY IF EXISTS "Admins can update rooms" ON rooms;
DROP POLICY IF EXISTS "Admins can delete rooms" ON rooms;

CREATE POLICY "Admins can update rooms"
  ON rooms FOR UPDATE
  TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "Admins can delete rooms"
  ON rooms FOR DELETE
  TO authenticated
  USING (get_my_role() = 'admin');


-- ============================================================
-- 20260420014500_add_event_operator_keys_and_tickets.sql
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_compact_access_key()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  raw_key text := '';
  idx integer;
BEGIN
  FOR idx IN 1..12 LOOP
    raw_key := raw_key || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  END LOOP;

  RETURN substr(raw_key, 1, 4) || '-' || substr(raw_key, 5, 4) || '-' || substr(raw_key, 9, 4);
END;
$$;

CREATE TABLE IF NOT EXISTS public.event_operator_keys (
  event_id uuid PRIMARY KEY REFERENCES public.events(id) ON DELETE CASCADE,
  operator_auth_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_operator_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view operator keys"
  ON public.event_operator_keys FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert operator keys"
  ON public.event_operator_keys FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update operator keys"
  ON public.event_operator_keys FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

INSERT INTO public.event_operator_keys (event_id, operator_auth_key)
SELECT e.id, public.generate_compact_access_key()
FROM public.events e
WHERE NOT EXISTS (
  SELECT 1
  FROM public.event_operator_keys eok
  WHERE eok.event_id = e.id
);

CREATE TABLE IF NOT EXISTS public.event_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ticket_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  scanned_at timestamptz,
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own event tickets"
  ON public.event_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all event tickets"
  ON public.event_tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.create_event_with_operator_key(
  title text,
  description text,
  venue text,
  event_date timestamptz,
  capacity integer,
  image_url text DEFAULT '',
  tags text[] DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  created_title text,
  created_description text,
  created_venue text,
  created_event_date timestamptz,
  created_capacity integer,
  created_registered integer,
  created_image_url text,
  created_tags text[],
  created_organizer_id uuid,
  operator_auth_key text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_event public.events%ROWTYPE;
  new_key text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can create events';
  END IF;

  INSERT INTO public.events (
    title,
    description,
    venue,
    event_date,
    capacity,
    registered,
    image_url,
    tags,
    organizer_id
  )
  VALUES (
    title,
    COALESCE(description, ''),
    COALESCE(venue, ''),
    event_date,
    COALESCE(capacity, 100),
    0,
    COALESCE(image_url, ''),
    COALESCE(tags, '{}'),
    auth.uid()
  )
  RETURNING * INTO new_event;

  LOOP
    new_key := public.generate_compact_access_key();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.event_operator_keys eok WHERE eok.operator_auth_key = new_key
    );
  END LOOP;

  INSERT INTO public.event_operator_keys (event_id, operator_auth_key)
  VALUES (new_event.id, new_key);

  RETURN QUERY
  SELECT
    new_event.id,
    new_event.title,
    new_event.description,
    new_event.venue,
    new_event.event_date,
    new_event.capacity,
    new_event.registered,
    new_event.image_url,
    new_event.tags,
    new_event.organizer_id,
    new_key,
    new_event.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_event_operator_key(target_event_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_key text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can reset operator keys';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = target_event_id) THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  LOOP
    next_key := public.generate_compact_access_key();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.event_operator_keys eok WHERE eok.operator_auth_key = next_key
    );
  END LOOP;

  INSERT INTO public.event_operator_keys (event_id, operator_auth_key, rotated_at)
  VALUES (target_event_id, next_key, now())
  ON CONFLICT (event_id)
  DO UPDATE SET operator_auth_key = EXCLUDED.operator_auth_key, rotated_at = now();

  RETURN next_key;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_event_operator_key(input_key text)
RETURNS TABLE (
  event_id uuid,
  title text,
  venue text,
  event_date timestamptz,
  key_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.venue,
    e.event_date,
    eok.created_at
  FROM public.event_operator_keys eok
  JOIN public.events e ON e.id = eok.event_id
  WHERE upper(eok.operator_auth_key) = upper(trim(input_key))
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_event_ticket(target_event_id uuid)
RETURNS TABLE (
  ticket_id uuid,
  event_id uuid,
  ticket_hash text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  existing_ticket public.event_tickets%ROWTYPE;
  next_ticket public.event_tickets%ROWTYPE;
  source_event public.events%ROWTYPE;
  raw_hash text;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO source_event
  FROM public.events e
  WHERE e.id = target_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  SELECT * INTO existing_ticket
  FROM public.event_tickets et
  WHERE et.event_id = target_event_id
    AND et.user_id = requester_id
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY
    SELECT existing_ticket.id, existing_ticket.event_id, existing_ticket.ticket_hash, existing_ticket.status, existing_ticket.created_at;
    RETURN;
  END IF;

  IF source_event.registered >= source_event.capacity THEN
    RAISE EXCEPTION 'This event is sold out';
  END IF;

  LOOP
    raw_hash := 'SPH-' || substr(encode(gen_random_bytes(6), 'hex'), 1, 4) || '-' || substr(encode(gen_random_bytes(6), 'hex'), 1, 4) || '-' || substr(encode(gen_random_bytes(6), 'hex'), 1, 4);
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.event_tickets et WHERE upper(et.ticket_hash) = upper(raw_hash)
    );
  END LOOP;

  INSERT INTO public.event_tickets (event_id, user_id, ticket_hash, status)
  VALUES (target_event_id, requester_id, upper(raw_hash), 'active')
  RETURNING * INTO next_ticket;

  UPDATE public.events
  SET registered = registered + 1
  WHERE id = target_event_id;

  RETURN QUERY
  SELECT next_ticket.id, next_ticket.event_id, next_ticket.ticket_hash, next_ticket.status, next_ticket.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_event_scan(input_key text, input_hash text)
RETURNS TABLE (
  scan_status text,
  event_id uuid,
  event_title text,
  attendee_name text,
  attendee_email text,
  message text,
  scanned_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  operator_event public.events%ROWTYPE;
  ticket_row public.event_tickets%ROWTYPE;
  attendee public.profiles%ROWTYPE;
  resolved_status text;
  trimmed_hash text := upper(trim(input_hash));
BEGIN
  SELECT e.*
  INTO operator_event
  FROM public.event_operator_keys eok
  JOIN public.events e ON e.id = eok.event_id
  WHERE upper(eok.operator_auth_key) = upper(trim(input_key))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid operator key';
  END IF;

  SELECT * INTO ticket_row
  FROM public.event_tickets et
  WHERE et.event_id = operator_event.id
    AND upper(et.ticket_hash) = trimmed_hash
  LIMIT 1;

  IF NOT FOUND THEN
    resolved_status := 'invalid';
    INSERT INTO public.scan_logs (ticket_hash, event_id, status)
    VALUES (trimmed_hash, operator_event.id, resolved_status);

    RETURN QUERY
    SELECT resolved_status, operator_event.id, operator_event.title, NULL::text, NULL::text, 'Ticket not found for this event', now();
    RETURN;
  END IF;

  SELECT * INTO attendee
  FROM public.profiles p
  WHERE p.id = ticket_row.user_id;

  IF ticket_row.status = 'used' THEN
    resolved_status := 'already_scanned';
    INSERT INTO public.scan_logs (ticket_hash, event_id, status)
    VALUES (trimmed_hash, operator_event.id, resolved_status);

    RETURN QUERY
    SELECT resolved_status, operator_event.id, operator_event.title, attendee.full_name, attendee.email, 'Ticket already scanned earlier', now();
    RETURN;
  END IF;

  UPDATE public.event_tickets
  SET status = 'used',
      scanned_at = now()
  WHERE id = ticket_row.id;

  resolved_status := 'valid';
  INSERT INTO public.scan_logs (ticket_hash, event_id, status)
  VALUES (trimmed_hash, operator_event.id, resolved_status);

  RETURN QUERY
  SELECT resolved_status, operator_event.id, operator_event.title, attendee.full_name, attendee.email, 'Ticket validated successfully', now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_operator_scan_metrics(input_key text)
RETURNS TABLE (
  event_id uuid,
  event_title text,
  total_scans bigint,
  valid_scans bigint,
  invalid_scans bigint,
  already_scanned_scans bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  operator_event public.events%ROWTYPE;
BEGIN
  SELECT e.*
  INTO operator_event
  FROM public.event_operator_keys eok
  JOIN public.events e ON e.id = eok.event_id
  WHERE upper(eok.operator_auth_key) = upper(trim(input_key))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid operator key';
  END IF;

  RETURN QUERY
  SELECT
    operator_event.id,
    operator_event.title,
    COUNT(*)::bigint AS total_scans,
    COUNT(*) FILTER (WHERE sl.status = 'valid')::bigint AS valid_scans,
    COUNT(*) FILTER (WHERE sl.status = 'invalid')::bigint AS invalid_scans,
    COUNT(*) FILTER (WHERE sl.status = 'already_scanned')::bigint AS already_scanned_scans
  FROM public.scan_logs sl
  WHERE sl.event_id = operator_event.id;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_event_operator_key(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_event_scan(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_operator_scan_metrics(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_event_operator_key(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_event_scan(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_operator_scan_metrics(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_event_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_event_with_operator_key(text, text, text, timestamptz, integer, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_event_operator_key(uuid) TO authenticated;

CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );


-- ============================================================
-- 20260420024000_event_head_access_policies.sql
-- ============================================================
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

CREATE POLICY "Event heads can insert events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Event heads can update own events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (organizer_id = auth.uid())
  WITH CHECK (organizer_id = auth.uid());

CREATE POLICY "Event heads can delete own events"
  ON public.events FOR DELETE
  TO authenticated
  USING (organizer_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view operator keys" ON public.event_operator_keys;
DROP POLICY IF EXISTS "Admins can insert operator keys" ON public.event_operator_keys;
DROP POLICY IF EXISTS "Admins can update operator keys" ON public.event_operator_keys;

CREATE POLICY "Event heads can view own operator keys"
  ON public.event_operator_keys FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_operator_keys.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Event heads can insert own operator keys"
  ON public.event_operator_keys FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_operator_keys.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE POLICY "Event heads can update own operator keys"
  ON public.event_operator_keys FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_operator_keys.event_id
        AND e.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_operator_keys.event_id
        AND e.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all event tickets" ON public.event_tickets;

CREATE POLICY "Event heads can view tickets for own events"
  ON public.event_tickets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = event_tickets.event_id
        AND e.organizer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all scan logs" ON public.scan_logs;

CREATE POLICY "Event heads can view scan logs for own events"
  ON public.scan_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.events e
      WHERE e.id = scan_logs.event_id
        AND e.organizer_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.create_event_with_operator_key(
  title text,
  description text,
  venue text,
  event_date timestamptz,
  capacity integer,
  image_url text DEFAULT '',
  tags text[] DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  created_title text,
  created_description text,
  created_venue text,
  created_event_date timestamptz,
  created_capacity integer,
  created_registered integer,
  created_image_url text,
  created_tags text[],
  created_organizer_id uuid,
  operator_auth_key text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_event public.events%ROWTYPE;
  new_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.events (
    title,
    description,
    venue,
    event_date,
    capacity,
    registered,
    image_url,
    tags,
    organizer_id
  )
  VALUES (
    title,
    COALESCE(description, ''),
    COALESCE(venue, ''),
    event_date,
    COALESCE(capacity, 100),
    0,
    COALESCE(image_url, ''),
    COALESCE(tags, '{}'),
    auth.uid()
  )
  RETURNING * INTO new_event;

  LOOP
    new_key := public.generate_compact_access_key();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.event_operator_keys eok WHERE eok.operator_auth_key = new_key
    );
  END LOOP;

  INSERT INTO public.event_operator_keys (event_id, operator_auth_key)
  VALUES (new_event.id, new_key);

  RETURN QUERY
  SELECT
    new_event.id,
    new_event.title,
    new_event.description,
    new_event.venue,
    new_event.event_date,
    new_event.capacity,
    new_event.registered,
    new_event.image_url,
    new_event.tags,
    new_event.organizer_id,
    new_key,
    new_event.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_event_operator_key(target_event_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = target_event_id
      AND e.organizer_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the event head can rotate this operator key';
  END IF;

  LOOP
    next_key := public.generate_compact_access_key();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.event_operator_keys eok WHERE eok.operator_auth_key = next_key
    );
  END LOOP;

  INSERT INTO public.event_operator_keys (event_id, operator_auth_key, rotated_at)
  VALUES (target_event_id, next_key, now())
  ON CONFLICT (event_id)
  DO UPDATE SET operator_auth_key = EXCLUDED.operator_auth_key, rotated_at = now();

  RETURN next_key;
END;
$$;


-- ============================================================
-- 20260420032500_fix_claim_event_ticket_function.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_event_ticket(target_event_id uuid)
RETURNS TABLE (
  ticket_id uuid,
  event_id uuid,
  ticket_hash text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  generated_hash text;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = target_event_id
  ) THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.event_tickets et
    WHERE et.event_id = target_event_id
      AND et.user_id = requester_id
  ) THEN
    RETURN QUERY
    SELECT
      et.id,
      et.event_id,
      et.ticket_hash,
      et.status,
      et.created_at
    FROM public.event_tickets et
    WHERE et.event_id = target_event_id
      AND et.user_id = requester_id
    LIMIT 1;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = target_event_id
      AND e.registered >= e.capacity
  ) THEN
    RAISE EXCEPTION 'This event is sold out';
  END IF;

  LOOP
    generated_hash :=
      'SPH-' ||
      substr(encode(gen_random_bytes(6), 'hex'), 1, 4) || '-' ||
      substr(encode(gen_random_bytes(6), 'hex'), 1, 4) || '-' ||
      substr(encode(gen_random_bytes(6), 'hex'), 1, 4);

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.event_tickets et
      WHERE upper(et.ticket_hash) = upper(generated_hash)
    );
  END LOOP;

  INSERT INTO public.event_tickets (event_id, user_id, ticket_hash, status)
  VALUES (target_event_id, requester_id, upper(generated_hash), 'active');

  UPDATE public.events
  SET registered = registered + 1
  WHERE id = target_event_id;

  RETURN QUERY
  SELECT
    et.id,
    et.event_id,
    et.ticket_hash,
    et.status,
    et.created_at
  FROM public.event_tickets et
  WHERE et.event_id = target_event_id
    AND et.user_id = requester_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_event_ticket(uuid) TO authenticated;


-- ============================================================
-- 20260422223700_add_demo_account_guardrails.sql
-- ============================================================
/*
  # Read-only demo account

  ## Why
  The live demo is public, so anyone can sign in as demo@sphere.demo and look
  around. That account must not be able to change anything other people see.

  ## Approach
  The lock is a database rule, not a hidden button. Every existing policy on
  these tables is PERMISSIVE, and permissive policies OR together, so adding
  another one would only widen access. RESTRICTIVE policies AND with the rest,
  so a write has to satisfy both the original policy and this one.

  Deliberately still allowed: claiming an event ticket. It is the nicest thing
  to show a visitor, and UNIQUE (event_id, user_id) already caps the demo
  account at one ticket per event no matter how many people try it.

  Note the policies are split per command. FOR ALL would apply the USING clause
  to SELECT as well and make the demo account unable to read anything.
*/

CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.email = 'demo@sphere.demo' FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_demo_user() TO authenticated;

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY[
    'bookings',
    'volunteer_applications',
    'volunteer_gallery_photos',
    'events',
    'rooms',
    'event_operator_keys'
  ]
  LOOP
    IF to_regclass('public.' || target) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS "Demo account cannot insert" ON public.%I', target);
    EXECUTE format(
      'CREATE POLICY "Demo account cannot insert" ON public.%I
         AS RESTRICTIVE FOR INSERT TO authenticated
         WITH CHECK (NOT public.is_demo_user())', target);

    EXECUTE format('DROP POLICY IF EXISTS "Demo account cannot update" ON public.%I', target);
    EXECUTE format(
      'CREATE POLICY "Demo account cannot update" ON public.%I
         AS RESTRICTIVE FOR UPDATE TO authenticated
         USING (NOT public.is_demo_user())', target);

    EXECUTE format('DROP POLICY IF EXISTS "Demo account cannot delete" ON public.%I', target);
    EXECUTE format(
      'CREATE POLICY "Demo account cannot delete" ON public.%I
         AS RESTRICTIVE FOR DELETE TO authenticated
         USING (NOT public.is_demo_user())', target);
  END LOOP;
END $$;

-- profiles is a special case: the demo account still needs its own row created
-- on first sign in, so INSERT stays open. UPDATE does not, otherwise the demo
-- account could simply set its own role to admin.
DROP POLICY IF EXISTS "Demo account cannot update" ON public.profiles;
CREATE POLICY "Demo account cannot update"
  ON public.profiles
  AS RESTRICTIVE FOR UPDATE
  TO authenticated
  USING (NOT public.is_demo_user());

-- SECURITY DEFINER functions run as the owner and bypass RLS entirely, so the
-- policies above do not cover them. They need the check written in.
CREATE OR REPLACE FUNCTION public.create_event_with_operator_key(
  title text,
  description text,
  venue text,
  event_date timestamptz,
  capacity integer,
  image_url text DEFAULT '',
  tags text[] DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  created_title text,
  created_description text,
  created_venue text,
  created_event_date timestamptz,
  created_capacity integer,
  created_registered integer,
  created_image_url text,
  created_tags text[],
  created_organizer_id uuid,
  operator_auth_key text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_event public.events%ROWTYPE;
  new_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_demo_user() THEN
    RAISE EXCEPTION 'The demo account is read only';
  END IF;

  INSERT INTO public.events (
    title, description, venue, event_date, capacity, registered, image_url, tags, organizer_id
  )
  VALUES (
    title,
    COALESCE(description, ''),
    COALESCE(venue, ''),
    event_date,
    COALESCE(capacity, 100),
    0,
    COALESCE(image_url, ''),
    COALESCE(tags, '{}'),
    auth.uid()
  )
  RETURNING * INTO new_event;

  LOOP
    new_key := public.generate_compact_access_key();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.event_operator_keys eok WHERE eok.operator_auth_key = new_key
    );
  END LOOP;

  INSERT INTO public.event_operator_keys (event_id, operator_auth_key)
  VALUES (new_event.id, new_key);

  RETURN QUERY
  SELECT
    new_event.id, new_event.title, new_event.description, new_event.venue,
    new_event.event_date, new_event.capacity, new_event.registered,
    new_event.image_url, new_event.tags, new_event.organizer_id,
    new_key, new_event.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_event_operator_key(target_event_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_key text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF public.is_demo_user() THEN
    RAISE EXCEPTION 'The demo account is read only';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = target_event_id AND e.organizer_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Only the event head can rotate this operator key';
  END IF;

  LOOP
    next_key := public.generate_compact_access_key();
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.event_operator_keys eok WHERE eok.operator_auth_key = next_key
    );
  END LOOP;

  INSERT INTO public.event_operator_keys (event_id, operator_auth_key, rotated_at)
  VALUES (target_event_id, next_key, now())
  ON CONFLICT (event_id)
  DO UPDATE SET operator_auth_key = EXCLUDED.operator_auth_key, rotated_at = now();

  RETURN next_key;
END;
$$;


-- ============================================================
-- 20260425210600_fix_pgcrypto_search_path.sql
-- ============================================================
/*
  # Make claim_event_ticket find gen_random_bytes on hosted Supabase

  ## Problem
  claim_event_ticket is SECURITY DEFINER with SET search_path = public, which
  is the right instinct — pinning the search_path on a definer function stops
  a caller shadowing a table name and having the function operate on theirs.

  But on hosted Supabase, pgcrypto is installed into the extensions schema
  rather than public. With search_path pinned to public alone, gen_random_bytes
  is not visible and claiming a ticket fails:

    42883: function gen_random_bytes(integer) does not exist

  This never showed up locally because a local CREATE EXTENSION pgcrypto puts
  the functions straight into public. It only appears against a real project.

  ## Fix
  Add extensions to that one function's search_path. ALTER FUNCTION changes
  only the setting, so the body stays exactly as the previous migration left
  it. Guarded so this is still a no-op on a plain Postgres where there is no
  extensions schema.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    ALTER FUNCTION public.claim_event_ticket(uuid) SET search_path = public, extensions;
    RAISE NOTICE 'claim_event_ticket search_path now includes extensions';
  ELSE
    RAISE NOTICE 'no extensions schema, leaving search_path alone';
  END IF;
END $$;


-- ============================================================
-- 20260420_volunteer_gallery.sql
-- ============================================================
/*
  Volunteer Gallery setup

  Run this in Supabase SQL Editor.
  It creates:
  - a public bucket for gallery images
  - a volunteer_gallery_photos table
  - policies so anyone signed in can upload and publish photos
*/

insert into storage.buckets (id, name, public)
values ('volunteer-gallery', 'volunteer-gallery', true)
on conflict (id) do update set public = true;

create table if not exists public.volunteer_gallery_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '',
  caption text not null default '',
  image_url text not null,
  storage_path text,
  created_at timestamptz not null default now()
);

alter table public.volunteer_gallery_photos enable row level security;

drop policy if exists "Authenticated users can view volunteer gallery photos" on public.volunteer_gallery_photos;
create policy "Authenticated users can view volunteer gallery photos"
  on public.volunteer_gallery_photos
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert volunteer gallery photos" on public.volunteer_gallery_photos;
create policy "Authenticated users can insert volunteer gallery photos"
  on public.volunteer_gallery_photos
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own volunteer gallery photos" on public.volunteer_gallery_photos;
create policy "Users can update their own volunteer gallery photos"
  on public.volunteer_gallery_photos
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own volunteer gallery photos" on public.volunteer_gallery_photos;
create policy "Users can delete their own volunteer gallery photos"
  on public.volunteer_gallery_photos
  for delete
  to authenticated
  using (auth.uid() = user_id or get_my_role() = 'admin');

drop policy if exists "Authenticated users can view volunteer gallery storage" on storage.objects;
create policy "Authenticated users can view volunteer gallery storage"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'volunteer-gallery');

drop policy if exists "Authenticated users can upload volunteer gallery storage" on storage.objects;
create policy "Authenticated users can upload volunteer gallery storage"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'volunteer-gallery'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own volunteer gallery storage" on storage.objects;
create policy "Users can update their own volunteer gallery storage"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'volunteer-gallery'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'volunteer-gallery'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own volunteer gallery storage" on storage.objects;
create policy "Users can delete their own volunteer gallery storage"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'volunteer-gallery'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or get_my_role() = 'admin'
    )
  );


-- ============================================================
-- 20260420_seed_reference_room_booking_rooms.sql
-- ============================================================
/*
  Seed the exact room list used by the reference room-booking app.

  Run this in Supabase SQL Editor if the room browser is showing template rooms
  or if bookings fail because the reference rooms are not present in the rooms table yet.
*/

INSERT INTO public.rooms (name, capacity, location, amenities, available)
SELECT
  seed.name,
  seed.capacity,
  seed.location,
  seed.amenities,
  true
FROM (
  VALUES
    ('A 506', 40, 'B Dome A Wing', ARRAY['Projector', 'Blackboard']::text[]),
    ('C 308', 40, 'B Dome C Wing', ARRAY['Projector', 'Whiteboard']::text[]),
    ('CC Lab', 250, 'Computer Centre', ARRAY['Computers', 'Lab Equipment']::text[]),
    ('DLT 8', 300, 'Lecture Theatre Complex', ARRAY['Projector', 'Smartboard']::text[]),
    ('Hemu''s Cuckpit', 3, 'Faculty Block', ARRAY['Whiteboard']::text[])
) AS seed(name, capacity, location, amenities)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.rooms r
  WHERE lower(trim(r.name)) = lower(trim(seed.name))
);

