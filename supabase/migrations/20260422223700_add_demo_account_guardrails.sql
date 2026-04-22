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
