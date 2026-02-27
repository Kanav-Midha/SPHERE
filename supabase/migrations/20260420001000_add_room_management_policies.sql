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
