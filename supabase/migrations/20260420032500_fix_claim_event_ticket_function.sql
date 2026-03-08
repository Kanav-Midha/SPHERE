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
