/*
  Demo seed data

  Run this in the Supabase SQL Editor AFTER:
    1. every file in supabase/migrations/ has been run, in filename order
    2. supabase/manual/20260420_seed_reference_room_booking_rooms.sql
    3. supabase/manual/20260420_volunteer_gallery.sql
    4. the demo@sphere.demo user has been created in Authentication -> Users

  Safe to run more than once. Everything is keyed on stable titles or on the
  demo account's own id, so a second run updates rather than duplicates.

  Dates are relative to now(), so the demo does not go stale and start showing
  a wall of past events three months from today.
*/

DO $$
DECLARE
  demo_id uuid;
  ev_id uuid;
  target_room uuid;
  slot text;
  slots text[] := ARRAY['09:00-10:00', '11:00-12:00', '14:00-15:00'];
BEGIN
  SELECT id INTO demo_id FROM auth.users WHERE email = 'demo@sphere.demo';

  IF demo_id IS NULL THEN
    RAISE EXCEPTION 'Create the demo@sphere.demo user in Authentication -> Users first';
  END IF;

  -- The demo profile normally appears on first sign in. Create it up front so
  -- the seeded bookings below have an owner to point at.
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (demo_id, 'demo@sphere.demo', 'Demo Visitor', 'student')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  ---------------------------------------------------------------- events
  INSERT INTO public.events (title, description, venue, event_date, capacity, registered, image_url, tags, organizer_id)
  SELECT
    seed.title, seed.description, seed.venue,
    now() + (seed.days_out || ' days')::interval,
    seed.capacity, seed.registered, seed.image_url, seed.tags, demo_id
  FROM (
    VALUES
      ('Waves Cultural Night', 'The headline cultural evening — music, dance and the closing showcase.',
       'Main Auditorium', 12, 300, 184,
       'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&q=80',
       ARRAY['cultural','music','flagship']::text[]),
      ('Quark Robotics Finals', 'Line follower and combat robotics finals, judged live.',
       'Computer Centre', 5, 250, 231,
       'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80',
       ARRAY['technical','robotics']::text[]),
      ('Startup Pitch Evening', 'Six student teams pitch to a panel of visiting founders.',
       'DLT 8', 19, 180, 92,
       'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=1200&q=80',
       ARRAY['entrepreneurship','talk']::text[]),
      ('Open Mic at the Amphi', 'Poetry, stand-up and acoustic sets. Turn up and put your name down.',
       'Amphitheatre', 3, 120, 118,
       'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200&q=80',
       ARRAY['cultural','informal']::text[]),
      ('Intro to Postgres Internals', 'A workshop on query planning, indexes and how RLS is evaluated.',
       'A 506', 8, 40, 40,
       'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=1200&q=80',
       ARRAY['technical','workshop','database']::text[]),
      ('Monsoon Football Cup', 'Inter-hostel knockout. Finals under lights.',
       'Sports Ground', 26, 400, 137,
       'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1200&q=80',
       ARRAY['sports']::text[])
  ) AS seed(title, description, venue, days_out, capacity, registered, image_url, tags)
  WHERE NOT EXISTS (SELECT 1 FROM public.events e WHERE e.title = seed.title);

  -- Give every event an operator key so the scanner page has something to accept.
  INSERT INTO public.event_operator_keys (event_id, operator_auth_key)
  SELECT e.id, public.generate_compact_access_key()
  FROM public.events e
  WHERE NOT EXISTS (
    SELECT 1 FROM public.event_operator_keys k WHERE k.event_id = e.id
  );

  ------------------------------------------------------------- extra rooms
  INSERT INTO public.rooms (name, capacity, location, amenities, available)
  SELECT seed.name, seed.capacity, seed.location, seed.amenities, true
  FROM (
    VALUES
      ('Library Discussion Room 2', 12, 'Central Library', ARRAY['Whiteboard','Power outlets']::text[]),
      ('Music Room',               15, 'Student Activity Centre', ARRAY['Piano','Sound system']::text[]),
      ('Seminar Hall B',           80, 'B Dome', ARRAY['Projector','Mics','AC']::text[])
  ) AS seed(name, capacity, location, amenities)
  WHERE NOT EXISTS (SELECT 1 FROM public.rooms r WHERE r.name = seed.name);

  --------------------------------------------------- bookings for realism
  -- Occupy a few slots over the next week so the availability timeline has
  -- something to show instead of an empty grid.
  FOR target_room IN (SELECT id FROM public.rooms ORDER BY name LIMIT 4)
  LOOP
    FOREACH slot IN ARRAY slots
    LOOP
      INSERT INTO public.bookings (room_id, user_id, date, time_slot, purpose, status)
      VALUES (
        target_room, demo_id,
        (current_date + (1 + floor(random() * 5))::int),
        slot,
        (ARRAY['Club meeting','Project review','Practice session','Study group'])[(1 + floor(random() * 4))::int],
        (ARRAY['approved','approved','pending'])[(1 + floor(random() * 3))::int]
      )
      ON CONFLICT (room_id, date, time_slot) DO NOTHING;
    END LOOP;
  END LOOP;

  ------------------------------------------------------- volunteer events
  FOR ev_id IN (SELECT id FROM public.events ORDER BY event_date LIMIT 3)
  LOOP
    INSERT INTO public.volunteer_events (event_id, title, description, application_open, application_close, spots)
    SELECT
      ev_id,
      'Volunteer — ' || e.title,
      'Help run ' || e.title || '. Expect a briefing the evening before.',
      now() - interval '3 days',
      e.event_date - interval '2 days',
      20
    FROM public.events e
    WHERE e.id = ev_id
      AND NOT EXISTS (
        SELECT 1 FROM public.volunteer_events ve WHERE ve.event_id = ev_id
      );
  END LOOP;

  RAISE NOTICE 'Demo seed complete: % events, % rooms, % bookings',
    (SELECT count(*) FROM public.events),
    (SELECT count(*) FROM public.rooms),
    (SELECT count(*) FROM public.bookings);
END $$;
