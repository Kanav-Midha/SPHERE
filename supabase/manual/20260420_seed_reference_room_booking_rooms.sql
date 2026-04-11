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
