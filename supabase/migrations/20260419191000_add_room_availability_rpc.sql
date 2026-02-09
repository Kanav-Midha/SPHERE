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
