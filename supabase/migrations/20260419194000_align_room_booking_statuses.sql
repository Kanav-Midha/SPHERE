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
