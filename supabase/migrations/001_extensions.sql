-- 001_extensions.sql
-- Enable required Postgres extensions.
--
-- pgcrypto: provides gen_random_uuid() used as the default for every table's
--           primary key.
-- pgtap:    SQL-level test framework. Used by supabase/tests/ to assert RLS
--           policies behave correctly. Not required at runtime.
--
-- Supabase convention is to install extensions into the dedicated `extensions`
-- schema rather than `public`, keeping the public namespace clean.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgtap   with schema extensions;
