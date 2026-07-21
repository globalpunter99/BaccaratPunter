-- ============================================================================
-- 0006_delete_user.sql — super-admin user deletion
--
-- Deleting an auth user normally needs the service_role key, which must never
-- ship in client code (Vite inlines anything reachable from the bundle). So the
-- delete lives here instead: a SECURITY DEFINER function that runs with the
-- owner's rights, checks the CALLER is an active super admin, and refuses the
-- two cases that would lock everyone out or be an accident.
--
-- What goes with the user:
--   profiles, sessions, user_state, feedback  — all cascade from auth.users
--   storage objects under <uid>/             — deleted explicitly, no FK there
--
-- This is irreversible. The UI asks the admin to type the username first.
--
-- Run in the Supabase SQL Editor after 0005.
-- ============================================================================

create or replace function public.delete_user(target_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  target_email text;
begin
  if not public.is_super_admin() then
    raise exception 'Only a super admin can delete a user';
  end if;

  if target_id = auth.uid() then
    raise exception 'You cannot delete your own account';
  end if;

  select email into target_email from auth.users where id = target_id;
  if target_email is null then
    raise exception 'No such user';
  end if;

  -- The bootstrap super admin is the account that can always get back in.
  if lower(target_email) = lower(public.super_admin_email()) then
    raise exception 'The bootstrap super admin cannot be deleted';
  end if;

  -- Screen photos live in storage, which has no foreign key to auth.users,
  -- so they would otherwise be orphaned in the bucket forever.
  delete from storage.objects
  where bucket_id = 'screen-photos'
    and (storage.foldername(name))[1] = target_id::text;

  -- Everything else cascades from here (profiles, sessions, user_state,
  -- feedback all reference auth.users on delete cascade).
  delete from auth.users where id = target_id;
end;
$$;

revoke all on function public.delete_user(uuid) from public, anon;
grant execute on function public.delete_user(uuid) to authenticated;
