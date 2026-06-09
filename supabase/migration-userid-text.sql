-- Migration: make user ids plain TEXT (works for Supabase Auth UUIDs stored as
-- text AND for anonymous dev ids). Run once in the SQL editor.

-- Drop the FK + change column types.
alter table ce_clubs drop constraint if exists ce_clubs_owner_user_id_fkey;
alter table ce_clubs alter column owner_user_id type text using owner_user_id::text;

alter table ce_users alter column auth_user_id type text using auth_user_id::text;
alter table ce_users alter column id type text using id::text;
alter table ce_users alter column id drop default;
