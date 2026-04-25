/*
  # Make claim_event_ticket find gen_random_bytes on hosted Supabase

  ## Problem
  claim_event_ticket is SECURITY DEFINER with SET search_path = public, which
  is the right instinct — pinning the search_path on a definer function stops
  a caller shadowing a table name and having the function operate on theirs.

  But on hosted Supabase, pgcrypto is installed into the extensions schema
  rather than public. With search_path pinned to public alone, gen_random_bytes
  is not visible and claiming a ticket fails:

    42883: function gen_random_bytes(integer) does not exist

  This never showed up locally because a local CREATE EXTENSION pgcrypto puts
  the functions straight into public. It only appears against a real project.

  ## Fix
  Add extensions to that one function's search_path. ALTER FUNCTION changes
  only the setting, so the body stays exactly as the previous migration left
  it. Guarded so this is still a no-op on a plain Postgres where there is no
  extensions schema.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'extensions') THEN
    ALTER FUNCTION public.claim_event_ticket(uuid) SET search_path = public, extensions;
    RAISE NOTICE 'claim_event_ticket search_path now includes extensions';
  ELSE
    RAISE NOTICE 'no extensions schema, leaving search_path alone';
  END IF;
END $$;
