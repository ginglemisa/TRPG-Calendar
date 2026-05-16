create extension if not exists pgcrypto;

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.gms (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  host_name text not null check (char_length(host_name) between 1 and 40),
  system_name text not null check (char_length(system_name) between 1 and 40),
  scenario_name text,
  event_date date,
  start_time time,
  end_time time,
  location_name text not null,
  map_url text,
  line_url text,
  seats_total integer not null check (seats_total between 1 and 20),
  approved_players_count integer not null default 0 check (approved_players_count >= 0),
  description text,
  is_date_undecided boolean not null default false,
  is_registration_closed boolean not null default false,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.events
add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;

alter table public.events
add column if not exists approved_players_count integer not null default 0 check (approved_players_count >= 0);

alter table public.events
add column if not exists is_date_undecided boolean not null default false;

alter table public.events
add column if not exists is_registration_closed boolean not null default false;

alter table public.events
alter column event_date drop not null;

alter table public.events
alter column start_time drop not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_date_required_unless_undecided'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_date_required_unless_undecided
      check (is_date_undecided or event_date is not null)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_map_url_http_url'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_map_url_http_url
      check (map_url is null or map_url ~* '^https?://[^[:space:]]+$')
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_line_url_http_url'
      and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_line_url_http_url
      check (line_url is null or line_url ~* '^https?://[^[:space:]]+$')
      not valid;
  end if;
end;
$$;

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  applicant_name text not null check (char_length(applicant_name) between 1 and 40),
  contact_info text not null check (char_length(contact_info) between 1 and 120),
  players_count integer not null default 1 check (players_count between 1 and 6),
  note text,
  time_label text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.join_requests
add column if not exists time_label text;

create table if not exists public.event_private_notes (
  event_id uuid primary key references public.events(id) on delete cascade,
  gm_notes text,
  updated_at timestamptz not null default now()
);

create table if not exists public.availability_polls (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  date_start date not null,
  date_end date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_start <= date_end)
);

create table if not exists public.availability_players (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.availability_polls(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  personal_token text not null unique check (char_length(personal_token) >= 48),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.availability_slots (
  id bigserial primary key,
  player_id uuid not null references public.availability_players(id) on delete cascade,
  slot_date date not null,
  slot text not null check (slot in ('morning', 'afternoon', 'evening')),
  created_at timestamptz not null default now(),
  unique (player_id, slot_date, slot)
);

create index if not exists availability_polls_event_id_idx
on public.availability_polls(event_id);

create index if not exists availability_players_poll_id_idx
on public.availability_players(poll_id);

create index if not exists availability_players_personal_token_idx
on public.availability_players(personal_token);

create index if not exists availability_slots_player_id_idx
on public.availability_slots(player_id);

create index if not exists availability_slots_slot_date_idx
on public.availability_slots(slot_date);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists join_requests_set_updated_at on public.join_requests;
create trigger join_requests_set_updated_at
before update on public.join_requests
for each row execute function public.set_updated_at();

drop trigger if exists event_private_notes_set_updated_at on public.event_private_notes;
create trigger event_private_notes_set_updated_at
before update on public.event_private_notes
for each row execute function public.set_updated_at();

drop trigger if exists availability_polls_set_updated_at on public.availability_polls;
create trigger availability_polls_set_updated_at
before update on public.availability_polls
for each row execute function public.set_updated_at();

drop trigger if exists availability_players_set_updated_at on public.availability_players;
create trigger availability_players_set_updated_at
before update on public.availability_players
for each row execute function public.set_updated_at();

create or replace function public.keep_event_owner_user_id()
returns trigger
language plpgsql
as $$
begin
  if old.owner_user_id is not null then
    new.owner_user_id = old.owner_user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists events_keep_owner_user_id on public.events;
create trigger events_keep_owner_user_id
before update on public.events
for each row execute function public.keep_event_owner_user_id();

create or replace function public.refresh_event_approved_players(target_event_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.events
  set approved_players_count = coalesce((
    select sum(players_count)
    from public.join_requests
    where event_id = target_event_id
      and status = 'approved'
  ), 0)
  where id = target_event_id;
$$;

create or replace function public.refresh_event_approved_players_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_event_approved_players(old.event_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.event_id is distinct from new.event_id then
    perform public.refresh_event_approved_players(old.event_id);
  end if;

  perform public.refresh_event_approved_players(new.event_id);
  return new;
end;
$$;

drop trigger if exists join_requests_refresh_event_approved_players on public.join_requests;
create trigger join_requests_refresh_event_approved_players
after insert or update or delete on public.join_requests
for each row execute function public.refresh_event_approved_players_trigger();

update public.events
set approved_players_count = coalesce(approved_counts.players_count, 0)
from (
  select event_id, sum(players_count) as players_count
  from public.join_requests
  where status = 'approved'
  group by event_id
) as approved_counts
where events.id = approved_counts.event_id;

update public.events
set approved_players_count = 0
where approved_players_count is null;

update public.events
set owner_user_id = (select user_id from public.admins order by created_at limit 1)
where owner_user_id is null;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where user_id = (select auth.uid())
  );
$$;

create or replace function public.is_gm()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.gms
    where user_id = (select auth.uid())
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin() or public.is_gm();
$$;

create or replace function public.can_manage_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events
    where events.id = target_event_id
      and (
        public.is_admin()
        or (
          public.is_gm()
          and events.owner_user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function public.get_availability_poll(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event public.events%rowtype;
  poll_row public.availability_polls%rowtype;
  players_json jsonb := '[]'::jsonb;
begin
  select *
  into target_event
  from public.events
  where id = target_event_id;

  if not found then
    raise exception 'event_not_found';
  end if;

  if not public.can_manage_event(target_event_id) then
    raise exception 'permission_denied';
  end if;

  if not target_event.is_date_undecided then
    raise exception 'availability_requires_undecided_date';
  end if;

  select *
  into poll_row
  from public.availability_polls
  where event_id = target_event_id;

  if not found then
    return jsonb_build_object(
      'event', jsonb_build_object(
        'id', target_event.id,
        'title', target_event.title,
        'event_date', target_event.event_date,
        'is_date_undecided', target_event.is_date_undecided,
        'start_time', target_event.start_time,
        'end_time', target_event.end_time,
        'host_name', target_event.host_name,
        'system_name', target_event.system_name,
        'scenario_name', target_event.scenario_name
      ),
      'poll', null,
      'players', '[]'::jsonb
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', availability_players.id,
        'display_name', availability_players.display_name,
        'personal_token', availability_players.personal_token,
        'submitted_at', availability_players.submitted_at,
        'updated_at', availability_players.updated_at,
        'slots', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'slot_date', availability_slots.slot_date,
              'slot', availability_slots.slot
            )
            order by availability_slots.slot_date, availability_slots.slot
          )
          from public.availability_slots
          where availability_slots.player_id = availability_players.id
        ), '[]'::jsonb)
      )
      order by availability_players.created_at, availability_players.id
    ),
    '[]'::jsonb
  )
  into players_json
  from public.availability_players
  where availability_players.poll_id = poll_row.id;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'id', target_event.id,
      'title', target_event.title,
      'event_date', target_event.event_date,
      'is_date_undecided', target_event.is_date_undecided,
      'start_time', target_event.start_time,
      'end_time', target_event.end_time,
      'host_name', target_event.host_name,
      'system_name', target_event.system_name,
      'scenario_name', target_event.scenario_name
    ),
    'poll', jsonb_build_object(
      'id', poll_row.id,
      'event_id', poll_row.event_id,
      'date_start', poll_row.date_start,
      'date_end', poll_row.date_end,
      'created_at', poll_row.created_at,
      'updated_at', poll_row.updated_at
    ),
    'players', players_json
  );
end;
$$;

create or replace function public.create_availability_poll(
  target_event_id uuid,
  poll_date_start date,
  poll_date_end date,
  player_names text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event public.events%rowtype;
  poll_id uuid;
  cleaned_names text[];
  player_name text;
  token_value text;
begin
  select *
  into target_event
  from public.events
  where id = target_event_id;

  if not found then
    raise exception 'event_not_found';
  end if;

  if not public.can_manage_event(target_event_id) then
    raise exception 'permission_denied';
  end if;

  if not target_event.is_date_undecided then
    raise exception 'availability_requires_undecided_date';
  end if;

  if poll_date_start is null or poll_date_end is null or poll_date_start > poll_date_end then
    raise exception 'invalid_poll_date_range';
  end if;

  select array_agg(name)
  into cleaned_names
  from (
    select btrim(raw_name) as name
    from unnest(player_names) as raw(raw_name)
    where btrim(raw_name) <> ''
  ) as cleaned;

  if cleaned_names is null or array_length(cleaned_names, 1) < 1 then
    raise exception 'availability_players_required';
  end if;

  if array_length(cleaned_names, 1) > 50 then
    raise exception 'too_many_availability_players';
  end if;

  if exists (
    select 1
    from unnest(cleaned_names) as cleaned(name)
    where char_length(name) > 80
  ) then
    raise exception 'availability_player_name_too_long';
  end if;

  insert into public.availability_polls (event_id, owner_user_id, date_start, date_end)
  values (target_event_id, target_event.owner_user_id, poll_date_start, poll_date_end)
  returning id into poll_id;

  foreach player_name in array cleaned_names loop
    loop
      token_value := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
      begin
        insert into public.availability_players (poll_id, display_name, personal_token)
        values (poll_id, player_name, token_value);
        exit;
      exception
        when unique_violation then
          null;
      end;
    end loop;
  end loop;

  return public.get_availability_poll(target_event_id);
exception
  when unique_violation then
    raise exception 'availability_poll_exists';
end;
$$;

create or replace function public.clear_availability_poll(target_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if not exists (select 1 from public.events where id = target_event_id) then
    raise exception 'event_not_found';
  end if;

  if not public.can_manage_event(target_event_id) then
    raise exception 'permission_denied';
  end if;

  delete from public.availability_polls
  where event_id = target_event_id;

  get diagnostics deleted_count = row_count;

  if deleted_count = 0 then
    raise exception 'availability_poll_not_found';
  end if;

  return jsonb_build_object('cleared', true);
end;
$$;

create or replace function public.get_player_availability(target_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  player_row public.availability_players%rowtype;
  poll_row public.availability_polls%rowtype;
  target_event public.events%rowtype;
  slots_json jsonb := '[]'::jsonb;
begin
  select *
  into player_row
  from public.availability_players
  where personal_token = target_token;

  if not found then
    raise exception 'availability_link_invalid';
  end if;

  select *
  into poll_row
  from public.availability_polls
  where id = player_row.poll_id;

  if not found then
    raise exception 'availability_link_invalid';
  end if;

  select *
  into target_event
  from public.events
  where id = poll_row.event_id;

  if not found then
    raise exception 'availability_link_invalid';
  end if;

  if not target_event.is_date_undecided then
    raise exception 'availability_link_invalid';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'slot_date', availability_slots.slot_date,
        'slot', availability_slots.slot
      )
      order by availability_slots.slot_date, availability_slots.slot
    ),
    '[]'::jsonb
  )
  into slots_json
  from public.availability_slots
  where availability_slots.player_id = player_row.id;

  return jsonb_build_object(
    'event', jsonb_build_object(
      'title', target_event.title,
      'event_date', target_event.event_date,
      'is_date_undecided', target_event.is_date_undecided,
      'start_time', target_event.start_time,
      'end_time', target_event.end_time,
      'host_name', target_event.host_name,
      'system_name', target_event.system_name,
      'scenario_name', target_event.scenario_name
    ),
    'poll', jsonb_build_object(
      'date_start', poll_row.date_start,
      'date_end', poll_row.date_end
    ),
    'player', jsonb_build_object(
      'display_name', player_row.display_name,
      'submitted_at', player_row.submitted_at,
      'updated_at', player_row.updated_at
    ),
    'slots', slots_json
  );
end;
$$;

create or replace function public.submit_player_availability(target_token text, selected_slots jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  player_row public.availability_players%rowtype;
  poll_row public.availability_polls%rowtype;
  target_event public.events%rowtype;
  slot_item jsonb;
  slot_date_value date;
  slot_name text;
begin
  if selected_slots is null or jsonb_typeof(selected_slots) <> 'array' then
    raise exception 'invalid_availability_slots';
  end if;

  select *
  into player_row
  from public.availability_players
  where personal_token = target_token
  for update;

  if not found then
    raise exception 'availability_link_invalid';
  end if;

  select *
  into poll_row
  from public.availability_polls
  where id = player_row.poll_id;

  if not found then
    raise exception 'availability_link_invalid';
  end if;

  select *
  into target_event
  from public.events
  where id = poll_row.event_id;

  if not found then
    raise exception 'availability_link_invalid';
  end if;

  if not target_event.is_date_undecided then
    raise exception 'availability_link_invalid';
  end if;

  delete from public.availability_slots
  where player_id = player_row.id;

  for slot_item in
    select value
    from jsonb_array_elements(selected_slots)
  loop
    begin
      slot_date_value := (slot_item ->> 'slot_date')::date;
    exception
      when others then
        raise exception 'invalid_slot_date';
    end;

    slot_name := slot_item ->> 'slot';

    if slot_name not in ('morning', 'afternoon', 'evening') then
      raise exception 'invalid_slot_name';
    end if;

    if slot_date_value < poll_row.date_start or slot_date_value > poll_row.date_end then
      raise exception 'slot_date_out_of_range';
    end if;

    insert into public.availability_slots (player_id, slot_date, slot)
    values (player_row.id, slot_date_value, slot_name)
    on conflict (player_id, slot_date, slot) do nothing;
  end loop;

  update public.availability_players
  set submitted_at = now()
  where id = player_row.id;

  return public.get_player_availability(target_token);
end;
$$;

alter table public.admins enable row level security;
alter table public.gms enable row level security;
alter table public.events enable row level security;
alter table public.join_requests enable row level security;
alter table public.event_private_notes enable row level security;
alter table public.availability_polls enable row level security;
alter table public.availability_players enable row level security;
alter table public.availability_slots enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'join_requests'
  loop
    execute format('drop policy if exists %I on public.join_requests', existing_policy.policyname);
  end loop;
end;
$$;

drop policy if exists "Admins can read own admin row" on public.admins;
create policy "Admins can read own admin row"
on public.admins
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Public can read admin display names" on public.admins;
create policy "Public can read admin display names"
on public.admins
for select
to anon, authenticated
using (true);

drop policy if exists "GMs can read own gm row" on public.gms;
create policy "GMs can read own gm row"
on public.gms
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "Public can read gm display names" on public.gms;
create policy "Public can read gm display names"
on public.gms
for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can read public events" on public.events;
create policy "Anyone can read public events"
on public.events
for select
to anon, authenticated
using (is_public = true);

drop policy if exists "Staff can read manageable events" on public.events;
create policy "Staff can read manageable events"
on public.events
for select
to authenticated
using (
  public.is_admin()
  or (public.is_gm() and owner_user_id = (select auth.uid()))
);

drop policy if exists "Staff can insert events" on public.events;
drop policy if exists "Admins can insert events" on public.events;
drop policy if exists "GMs can insert own events" on public.events;

create policy "Admins can insert events"
on public.events
for insert
to authenticated
with check (public.is_admin());

create policy "GMs can insert own events"
on public.events
for insert
to authenticated
with check (
  public.is_gm()
  and owner_user_id = (select auth.uid())
);

drop policy if exists "Staff can update events" on public.events;
create policy "Staff can update events"
on public.events
for update
to authenticated
using (
  public.is_admin()
  or (public.is_gm() and owner_user_id = (select auth.uid()))
)
with check (
  public.is_admin()
  or (public.is_gm() and owner_user_id = (select auth.uid()))
);

drop policy if exists "Staff can delete events" on public.events;
create policy "Staff can delete events"
on public.events
for delete
to authenticated
using (
  public.is_admin()
  or (public.is_gm() and owner_user_id = (select auth.uid()))
);

drop policy if exists "Staff can read managed event private notes" on public.event_private_notes;
create policy "Staff can read managed event private notes"
on public.event_private_notes
for select
to authenticated
using (public.can_manage_event(event_id));

drop policy if exists "Staff can insert managed event private notes" on public.event_private_notes;
create policy "Staff can insert managed event private notes"
on public.event_private_notes
for insert
to authenticated
with check (public.can_manage_event(event_id));

drop policy if exists "Staff can update managed event private notes" on public.event_private_notes;
create policy "Staff can update managed event private notes"
on public.event_private_notes
for update
to authenticated
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

drop policy if exists "Staff can delete managed event private notes" on public.event_private_notes;
create policy "Staff can delete managed event private notes"
on public.event_private_notes
for delete
to authenticated
using (public.can_manage_event(event_id));

drop policy if exists "Guests can create join requests" on public.join_requests;
create policy "Guests can create join requests"
on public.join_requests
for insert
to anon, authenticated
with check (
  status = 'pending'
  and exists (
    select 1
    from public.events
    where events.id = join_requests.event_id
      and events.is_public = true
      and events.is_registration_closed = false
  )
);

drop policy if exists "Admins can read join requests" on public.join_requests;
drop policy if exists "Staff can read join requests" on public.join_requests;
create policy "Staff can read join requests"
on public.join_requests
for select
to authenticated
using (public.can_manage_event(event_id));

drop policy if exists "Admins can update join requests" on public.join_requests;
drop policy if exists "Staff can update join requests" on public.join_requests;
create policy "Staff can update join requests"
on public.join_requests
for update
to authenticated
using (public.can_manage_event(event_id))
with check (public.can_manage_event(event_id));

drop policy if exists "Admins can delete join requests" on public.join_requests;
drop policy if exists "Staff can delete join requests" on public.join_requests;
create policy "Staff can delete join requests"
on public.join_requests
for delete
to authenticated
using (public.can_manage_event(event_id));

drop policy if exists "Staff can read managed availability polls" on public.availability_polls;
create policy "Staff can read managed availability polls"
on public.availability_polls
for select
to authenticated
using (public.can_manage_event(event_id));

drop policy if exists "Staff can read managed availability players" on public.availability_players;
create policy "Staff can read managed availability players"
on public.availability_players
for select
to authenticated
using (
  exists (
    select 1
    from public.availability_polls
    where availability_polls.id = availability_players.poll_id
      and public.can_manage_event(availability_polls.event_id)
  )
);

drop policy if exists "Staff can read managed availability slots" on public.availability_slots;
create policy "Staff can read managed availability slots"
on public.availability_slots
for select
to authenticated
using (
  exists (
    select 1
    from public.availability_players
    join public.availability_polls
      on availability_polls.id = availability_players.poll_id
    where availability_players.id = availability_slots.player_id
      and public.can_manage_event(availability_polls.event_id)
  )
);

grant usage on schema public to anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert on public.join_requests to anon, authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select, update, delete on public.join_requests to authenticated;
grant select, insert, update, delete on public.event_private_notes to authenticated;
grant select on public.admins to anon, authenticated;
grant select on public.gms to anon, authenticated;
grant select on public.availability_polls to authenticated;
grant select on public.availability_players to authenticated;
grant select on public.availability_slots to authenticated;
revoke all on function public.set_updated_at() from public;
revoke all on function public.keep_event_owner_user_id() from public;
revoke all on function public.refresh_event_approved_players(uuid) from public;
revoke all on function public.refresh_event_approved_players_trigger() from public;
revoke all on function public.get_availability_poll(uuid) from public;
revoke all on function public.create_availability_poll(uuid, date, date, text[]) from public;
revoke all on function public.clear_availability_poll(uuid) from public;
revoke all on function public.get_player_availability(text) from public;
revoke all on function public.submit_player_availability(text, jsonb) from public;
grant execute on function public.get_availability_poll(uuid) to authenticated;
grant execute on function public.create_availability_poll(uuid, date, date, text[]) to authenticated;
grant execute on function public.clear_availability_poll(uuid) to authenticated;
grant execute on function public.get_player_availability(text) to anon, authenticated;
grant execute on function public.submit_player_availability(text, jsonb) to anon, authenticated;
