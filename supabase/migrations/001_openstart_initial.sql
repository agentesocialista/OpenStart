-- OpenStart: profili e pagine condivise
-- Le tabelle non sono accessibili direttamente dal client: tutto passa da funzioni RPC
-- security definer che verificano il codice a 6 caratteri.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.shared_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[A-Z0-9]{8}$'),
  profile_code text not null references public.profiles(code) on delete cascade,
  page_id text not null,
  title text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_code_idx on public.profiles (code);
create index if not exists shared_pages_slug_idx on public.shared_pages (slug);

alter table public.profiles enable row level security;
alter table public.shared_pages enable row level security;
revoke all on public.profiles from anon, authenticated;
revoke all on public.shared_pages from anon, authenticated;
grant usage on schema public to anon, authenticated;

create or replace function public.os_set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.os_set_updated_at();

drop trigger if exists shared_pages_set_updated_at on public.shared_pages;
create trigger shared_pages_set_updated_at before update on public.shared_pages
for each row execute function public.os_set_updated_at();

create or replace function public.os_create_profile(p_code text, p_name text, p_data jsonb default '{}'::jsonb)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v public.profiles;
begin
  if p_code is null or p_code !~ '^[A-Z0-9]{6}$' then raise exception 'Codice non valido'; end if;
  if p_name is null or char_length(btrim(p_name)) = 0 then raise exception 'Nome obbligatorio'; end if;
  insert into public.profiles (code, name, data)
  values (upper(p_code), btrim(p_name), coalesce(p_data, '{}'::jsonb))
  returning * into v;
  return v;
end;
$$;

create or replace function public.os_get_profile(p_code text)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v public.profiles;
begin
  if p_code is null then return null; end if;
  select * into v from public.profiles where code = upper(p_code);
  return v;
end;
$$;

create or replace function public.os_update_profile(p_code text, p_data jsonb, p_name text default null)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v public.profiles;
begin
  update public.profiles
     set data = coalesce(p_data, data),
         name = case when p_name is null or btrim(p_name) = '' then name else btrim(p_name) end
   where code = upper(p_code)
  returning * into v;
  return v;
end;
$$;

create or replace function public.os_delete_profile(p_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.profiles where code = upper(p_code);
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

create or replace function public.os_create_share(p_code text, p_slug text, p_page_id text, p_title text, p_data jsonb)
returns public.shared_pages language plpgsql security definer set search_path = public as $$
declare v public.shared_pages;
begin
  insert into public.shared_pages (slug, profile_code, page_id, title, data)
  values (upper(p_slug), upper(p_code), p_page_id, p_title, coalesce(p_data, '{}'::jsonb))
  returning * into v;
  return v;
end;
$$;

create or replace function public.os_get_share(p_slug text)
returns public.shared_pages language plpgsql security definer set search_path = public as $$
declare v public.shared_pages;
begin
  select * into v from public.shared_pages where slug = upper(p_slug);
  return v;
end;
$$;

create or replace function public.os_update_share(p_code text, p_slug text, p_page_id text, p_title text, p_data jsonb)
returns public.shared_pages language plpgsql security definer set search_path = public as $$
declare v public.shared_pages;
begin
  update public.shared_pages
     set page_id = coalesce(p_page_id, page_id),
         title = coalesce(p_title, title),
         data = coalesce(p_data, data)
   where slug = upper(p_slug) and profile_code = upper(p_code)
  returning * into v;
  return v;
end;
$$;

create or replace function public.os_delete_share(p_code text, p_slug text)
returns boolean language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.shared_pages where slug = upper(p_slug) and profile_code = upper(p_code);
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.os_set_updated_at() from public;
grant execute on function public.os_create_profile(text, text, jsonb) to anon, authenticated;
grant execute on function public.os_get_profile(text) to anon, authenticated;
grant execute on function public.os_update_profile(text, jsonb, text) to anon, authenticated;
grant execute on function public.os_delete_profile(text) to anon, authenticated;
grant execute on function public.os_create_share(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.os_get_share(text) to anon, authenticated;
grant execute on function public.os_update_share(text, text, text, text, jsonb) to anon, authenticated;
grant execute on function public.os_delete_share(text, text) to anon, authenticated;
