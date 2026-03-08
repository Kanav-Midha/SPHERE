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
