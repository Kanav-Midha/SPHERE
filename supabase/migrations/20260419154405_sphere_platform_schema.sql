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
