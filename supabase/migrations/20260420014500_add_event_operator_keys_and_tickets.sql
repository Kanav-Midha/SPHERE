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
