-- Planned schema for the real backend (not wired up yet — the app still runs
-- entirely on AsyncStorage, see src/services/supabaseClient.ts). Covers auth,
-- gym profile, users, check-ins, live-floor stats, products, announcements,
-- posts/reports, coach profiles/services, and machine logs.
--
-- Still missing before the app can migrate to it: product_reservations,
-- post_comments, post_likes, activity_events (Wall notifications), classes
-- (with bookings), and club_members (roster + membership expiry) — add these
-- as a follow-up migration once you're ready to wire a given feature up.
create extension if not exists pgcrypto;

create table if not exists public.gym_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (btrim(code) <> ''),
  name text not null,
  slug text unique,
  logo_url text,
  primary_color text not null default '#111827',
  secondary_color text,
  timezone text not null default 'Africa/Tunis',
  download_path text unique,
  occupancy_config jsonb not null default '{
    "baseline_weight": 0.35,
    "real_checkin_min_count": 5,
    "quiet_ratio": 0.35,
    "busy_ratio": 0.75,
    "active_checkin_ttl_minutes": 180
  }'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  gym_id uuid not null references public.gym_profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'coach', 'owner')),
  full_name text not null,
  gender text not null check (gender in ('male', 'female')),
  age smallint not null check (age between 10 and 100),
  usual_training_time text not null check (usual_training_time in ('morning', 'afternoon', 'evening', 'time')),
  usual_training_hour smallint check (usual_training_hour between 0 and 23),
  usual_muscle_groups text[] not null default '{}' check (
    not exists (
      select 1
      from unnest(usual_muscle_groups) as value
      where value not in ('chest', 'back', 'legs', 'arms', 'cardio', 'full body')
    )
  ),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  gym_id uuid not null references public.gym_profiles(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  muscle_groups text[] not null default '{}',
  source text not null default 'manual' check (source in ('manual', 'geofence', 'door_qr', 'future')),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at >= started_at)
);

create index if not exists check_ins_gym_started_at_idx on public.check_ins (gym_id, started_at desc);
create index if not exists check_ins_user_status_idx on public.check_ins (user_id, status);
create unique index if not exists check_ins_one_active_per_user
  on public.check_ins (user_id)
  where status = 'active';

create table if not exists public.gym_hourly_occupancy_stats (
  gym_id uuid not null references public.gym_profiles(id) on delete cascade,
  hour_of_day smallint not null check (hour_of_day between 0 and 23),
  typical_count numeric not null default 0,
  quiet_threshold numeric not null default 0,
  busy_threshold numeric not null default 0,
  sample_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (gym_id, hour_of_day)
);

create table if not exists public.gym_muscle_hourly_stats (
  gym_id uuid not null references public.gym_profiles(id) on delete cascade,
  hour_of_day smallint not null check (hour_of_day between 0 and 23),
  muscle_group text not null check (muscle_group in ('chest', 'back', 'legs', 'arms', 'cardio', 'full body')),
  typical_count numeric not null default 0,
  sample_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (gym_id, hour_of_day, muscle_group)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gym_profiles(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  photo_url text,
  price_minor integer not null check (price_minor >= 0),
  description text not null default '',
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gym_profiles(id) on delete cascade,
  owner_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  priority text not null default 'normal' check (priority in ('normal', 'important')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gym_profiles(id) on delete cascade,
  author_id uuid not null references public.users(id) on delete cascade,
  body text not null,
  image_url text,
  status text not null default 'published' check (status in ('published', 'reported', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references public.users(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create table if not exists public.coach_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  gym_id uuid not null references public.gym_profiles(id) on delete cascade,
  bio text not null default '',
  specialties text[] not null default '{}',
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    not exists (
      select 1
      from unnest(specialties) as value
      where value not in ('strength', 'hypertrophy', 'cardio', 'mobility', 'technique', 'general fitness')
    )
  )
);

create table if not exists public.coach_services (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(user_id) on delete cascade,
  gym_id uuid not null references public.gym_profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  price_minor integer check (price_minor >= 0),
  duration_minutes integer check (duration_minutes > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.machine_logs (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gym_profiles(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  machine_label text not null,
  photo_url text,
  exercise_name text not null,
  weight_kg numeric(6,2) check (weight_kg >= 0),
  reps integer not null check (reps > 0),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists machine_logs_latest_idx
  on public.machine_logs (gym_id, user_id, machine_label, logged_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_gym_profiles on public.gym_profiles;
create trigger set_updated_at_gym_profiles
before update on public.gym_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_users on public.users;
create trigger set_updated_at_users
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_check_ins on public.check_ins;
create trigger set_updated_at_check_ins
before update on public.check_ins
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_products on public.products;
create trigger set_updated_at_products
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_announcements on public.announcements;
create trigger set_updated_at_announcements
before update on public.announcements
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_posts on public.posts;
create trigger set_updated_at_posts
before update on public.posts
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_post_reports on public.post_reports;
create trigger set_updated_at_post_reports
before update on public.post_reports
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_coach_profiles on public.coach_profiles;
create trigger set_updated_at_coach_profiles
before update on public.coach_profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_coach_services on public.coach_services;
create trigger set_updated_at_coach_services
before update on public.coach_services
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_machine_logs on public.machine_logs;
create trigger set_updated_at_machine_logs
before update on public.machine_logs
for each row execute function public.set_updated_at();

alter table public.gym_profiles enable row level security;
alter table public.users enable row level security;
alter table public.check_ins enable row level security;
alter table public.gym_hourly_occupancy_stats enable row level security;
alter table public.gym_muscle_hourly_stats enable row level security;
alter table public.products enable row level security;
alter table public.announcements enable row level security;
alter table public.posts enable row level security;
alter table public.post_reports enable row level security;
alter table public.coach_profiles enable row level security;
alter table public.coach_services enable row level security;
alter table public.machine_logs enable row level security;

create or replace function public.is_same_gym_member(target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users as u
    where u.id = auth.uid()
      and u.gym_id = target_gym_id
      and u.role in ('member', 'coach', 'owner')
  );
$$;

create or replace function public.is_same_gym_staff(target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users as u
    where u.id = auth.uid()
      and u.gym_id = target_gym_id
      and u.role in ('coach', 'owner')
  );
$$;

create or replace function public.is_gym_owner(target_gym_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.users as u
    where u.id = auth.uid()
      and u.gym_id = target_gym_id
      and u.role = 'owner'
  );
$$;

create or replace function public.get_gym_by_code(p_code text)
returns setof public.gym_profiles
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select *
  from public.gym_profiles
  where code = p_code;
$$;

create or replace function public.create_gym_profile(
  p_code text,
  p_name text,
  p_primary_color text default '#111827',
  p_secondary_color text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid := auth.uid();
  v_gym_id uuid;
begin
  if v_owner_id is null then
    raise exception 'An authenticated owner is required';
  end if;

  if not exists (
    select 1
    from public.users as u
    where u.id = v_owner_id
      and u.role = 'owner'
  ) then
    raise exception 'Only an owner can create a gym profile';
  end if;

  insert into public.gym_profiles (code, name, primary_color, secondary_color)
  values (btrim(p_code), p_name, coalesce(p_primary_color, '#111827'), p_secondary_color)
  returning id into v_gym_id;

  return v_gym_id;
end;
$$;

create or replace function public.complete_onboarding(
  p_gym_id uuid,
  p_full_name text,
  p_gender text,
  p_age smallint,
  p_usual_training_time text,
  p_usual_training_hour smallint,
  p_usual_muscle_groups text[]
)
returns public.users
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in before completing onboarding';
  end if;

  if p_gender not in ('male', 'female') then
    raise exception 'Gender must be male or female';
  end if;

  if p_age not between 10 and 100 then
    raise exception 'Age must be between 10 and 100';
  end if;

  if p_usual_training_time not in ('morning', 'afternoon', 'evening', 'time') then
    raise exception 'Choose a valid usual training time';
  end if;

  if p_usual_muscle_groups is null or exists (
    select 1
    from unnest(p_usual_muscle_groups) as value
    where value not in ('chest', 'back', 'legs', 'arms', 'cardio', 'full body')
  ) then
    raise exception 'Choose valid muscle groups';
  end if;

  if not exists (select 1 from public.gym_profiles where id = p_gym_id) then
    raise exception 'Gym not found';
  end if;

  if exists (select 1 from public.users where id = v_user_id) then
    update public.users
    set full_name = btrim(p_full_name),
        gender = p_gender,
        age = p_age,
        usual_training_time = p_usual_training_time,
        usual_training_hour = p_usual_training_hour,
        usual_muscle_groups = p_usual_muscle_groups,
        onboarding_completed_at = now()
    where id = v_user_id;
  else
    insert into public.users (
      id, gym_id, role, full_name, gender, age, usual_training_time,
      usual_training_hour, usual_muscle_groups, onboarding_completed_at
    )
    values (
      v_user_id, p_gym_id, 'member', btrim(p_full_name), p_gender, p_age,
      p_usual_training_time, p_usual_training_hour, p_usual_muscle_groups, now()
    );
  end if;

  return (select * from public.users where id = v_user_id);
end;
$$;

create or replace function public.start_check_in(
  p_gym_id uuid,
  p_muscle_groups text[],
  p_source text default 'manual'
)
returns public.check_ins
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_gym_id uuid;
  v_existing public.check_ins;
begin
  if v_user_id is null then
    raise exception 'Sign in before checking in';
  end if;

  select gym_id into v_gym_id
  from public.users
  where id = v_user_id;

  if v_gym_id is null then
    raise exception 'Member profile not found';
  end if;

  if v_gym_id <> p_gym_id then
    raise exception 'Check-in gym does not match your gym';
  end if;

  if p_source not in ('manual', 'geofence', 'door_qr', 'future') then
    raise exception 'Unsupported check-in source';
  end if;

  if p_muscle_groups is null then
    p_muscle_groups := array[]::text[];
  end if;

  select *
  from public.check_ins
  where user_id = v_user_id
    and status = 'active'
  order by started_at desc
  limit 1
  for update;

  if found then
    return v_existing;
  end if;

  insert into public.check_ins (user_id, gym_id, muscle_groups, source)
  values (v_user_id, p_gym_id, p_muscle_groups, p_source)
  returning * into v_existing;

  return v_existing;
end;
$$;

create or replace function public.end_check_in(p_check_in_id uuid)
returns public.check_ins
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.check_ins;
begin
  select *
  from public.check_ins
  where id = p_check_in_id
  for update;

  if not found then
    raise exception 'Check-in not found';
  end if;

  if v_row.user_id <> v_user_id and not public.is_same_gym_staff(v_row.gym_id) then
    raise exception 'You cannot end this check-in';
  end if;

  if v_row.status <> 'active' then
    raise exception 'Check-in is already finished';
  end if;

  update public.check_ins
  set ended_at = now(), status = 'completed'
  where id = p_check_in_id;

  return (select * from public.check_ins where id = p_check_in_id);
end;
$$;

create or replace function public.get_visit_streak(p_gym_id uuid)
returns table(current_streak integer, best_streak integer)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with member_dates as (
    select distinct (ci.started_at at time zone gp.timezone)::date as visit_date
    from public.check_ins as ci
    join public.gym_profiles as gp on gp.id = ci.gym_id
    where ci.user_id = auth.uid()
      and ci.gym_id = p_gym_id
      and ci.status = 'completed'
      and ci.started_at at time zone gp.timezone < now() + interval '1 day'
  ),
  recursive streaks as (
    select max(md.visit_date) as visit_date, 1::integer as streak
    from member_dates as md
    union all
    select (s.visit_date - 1), s.streak + 1
    from streaks as s
    join member_dates as md
      on md.visit_date = s.visit_date - 1
  ),
  totals as (
    select
      coalesce(max(s.streak) filter (where s.visit_date >= current_date - 1), 0) as current_streak,
      coalesce(max(s.streak), 0) as best_streak
    from streaks as s
  )
  select totals.current_streak::integer, totals.best_streak::integer
  from totals;
$$;

create or replace function public.refresh_occupancy_stats(p_gym_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_config jsonb;
  v_baseline_weight numeric;
  v_min_real integer;
  v_quiet_ratio numeric;
  v_busy_ratio numeric;
begin
  select occupancy_config into v_config
  from public.gym_profiles
  where id = p_gym_id;

  if v_config is null then
    raise exception 'Gym not found';
  end if;

  v_baseline_weight := coalesce((v_config ->> 'baseline_weight')::numeric, 0.35);
  v_min_real := coalesce((v_config ->> 'real_checkin_min_count')::integer, 5);
  v_quiet_ratio := coalesce((v_config ->> 'quiet_ratio')::numeric, 0.35);
  v_busy_ratio := coalesce((v_config ->> 'busy_ratio')::numeric, 0.75);

  with gym as (
    select id, timezone from public.gym_profiles where id = p_gym_id
  ), hours as (
    select generate_series(0, 23) as hour
  ), baseline as (
    select h.hour, count(u.id)::integer as baseline_count
    from gym as g
    cross join hours as h
    left join public.users as u
      on u.gym_id = g.id
     and u.usual_training_hour = h.hour
    group by h.hour
  ), observed as (
    select extract(hour from ci.started_at at time zone g.timezone)::smallint as hour,
           count(*)::integer as observed_count
    from public.check_ins as ci
    join gym as g on g.id = ci.gym_id
    where ci.gym_id = p_gym_id
      and ci.status = 'completed'
      and ci.started_at >= now() - interval '30 days'
    group by extract(hour from ci.started_at at time zone g.timezone)
  ), calibrated as (
    select b.hour,
           b.baseline_count,
           coalesce(o.observed_count, 0) as observed_count,
           case
             when coalesce(o.observed_count, 0) >= v_min_real
               then greatest(1::numeric, coalesce(o.observed_count, 0)::numeric)
             else b.baseline_count::numeric
           end as typical_count
    from baseline as b
    left join observed as o on o.hour = b.hour
  ), thresholds as (
    select hour,
           typical_count,
           greatest(0::numeric, floor(typical_count * v_quiet_ratio)) as quiet_threshold,
           greatest(1::numeric, ceil(typical_count * v_busy_ratio)) as busy_threshold,
           (coalesce(observed_count, 0) + baseline_count)::integer as sample_count
    from calibrated
  )
  insert into public.gym_hourly_occupancy_stats (
    gym_id, hour_of_day, typical_count, quiet_threshold, busy_threshold, sample_count, updated_at
  )
  select p_gym_id, hour, typical_count, quiet_threshold, busy_threshold, sample_count, now()
  from thresholds
  on conflict (gym_id, hour_of_day) do update
  set typical_count = excluded.typical_count,
      quiet_threshold = excluded.quiet_threshold,
      busy_threshold = excluded.busy_threshold,
      sample_count = excluded.sample_count,
      updated_at = now();

  with gym as (
    select id, timezone from public.gym_profiles where id = p_gym_id
  ), hours as (
    select generate_series(0, 23) as hour
  ), muscles as (
    select unnest(array['chest', 'back', 'legs', 'arms', 'cardio', 'full body']) as muscle_group
  ), baseline as (
    select h.hour, m.muscle_group, count(u.id)::integer as baseline_count
    from gym as g
    cross join hours as h
    cross join muscles as m
    left join public.users as u
      on u.gym_id = g.id
     and u.usual_training_hour = h.hour
     and u.usual_muscle_groups @> array[m.muscle_group]
    group by h.hour, m.muscle_group
  ), observed as (
    select extract(hour from ci.started_at at time zone g.timezone)::smallint as hour,
           muscle_group,
           count(*)::integer as observed_count
    from public.check_ins as ci
    join gym as g on g.id = ci.gym_id
    cross join lateral unnest(ci.muscle_groups) as muscle_group
    where ci.gym_id = p_gym_id
      and ci.status = 'completed'
      and ci.started_at >= now() - interval '30 days'
    group by extract(hour from ci.started_at at time zone g.timezone), muscle_group
  ), calibrated as (
    select b.hour, b.muscle_group, b.baseline_count,
           coalesce(o.observed_count, 0) as observed_count,
           case
             when coalesce(o.observed_count, 0) >= v_min_real
               then greatest(1::numeric, coalesce(o.observed_count, 0)::numeric)
             else b.baseline_count::numeric
           end as typical_count
    from baseline as b
    left join observed as o
      on o.hour = b.hour
     and o.muscle_group = b.muscle_group
  )
  insert into public.gym_muscle_hourly_stats (
    gym_id, hour_of_day, muscle_group, typical_count, sample_count, updated_at
  )
  select p_gym_id, hour, muscle_group, typical_count,
         (coalesce(observed_count, 0) + baseline_count)::integer, now()
  from calibrated
  on conflict (gym_id, hour_of_day, muscle_group) do update
  set typical_count = excluded.typical_count,
      sample_count = excluded.sample_count,
      updated_at = now();
end;
$$;

create or replace function public.get_live_floor(p_gym_id uuid, p_now timestamptz default now())
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with gym as (
    select gp.id, gp.timezone, gp.occupancy_config
    from public.gym_profiles as gp
    where gp.id = p_gym_id
  ), config as (
    select coalesce((occupancy_config ->> 'baseline_weight')::numeric, 0.35) as baseline_weight,
           coalesce((occupancy_config ->> 'real_checkin_min_count')::integer, 5) as real_checkin_min_count,
           coalesce((occupancy_config ->> 'quiet_ratio')::numeric, 0.35) as quiet_ratio,
           coalesce((occupancy_config ->> 'busy_ratio')::numeric, 0.75) as busy_ratio
    from gym
  ), now_context as (
    select p_now as now_ts,
           (p_now at time zone (select timezone from gym))::date as local_date,
           extract(hour from p_now at time zone (select timezone from gym))::smallint as current_hour
    from config
  ), hours as (
    select generate_series(0, 23) as hour
  ), observed_hours as (
    select h.hour, count(ci.id)::integer as observed
    from now_context as nc
    cross join hours as h
    left join gym as g on true
    left join public.check_ins as ci
      on ci.gym_id = g.id
     and ci.status = 'active'
     and ci.started_at >= (nc.local_date::timestamp at time zone g.timezone)
     and ci.started_at < nc.now_ts
     and extract(hour from ci.started_at at time zone g.timezone)::smallint = h.hour
    group by h.hour
  ), baseline_hours as (
    select h.hour, count(u.id)::integer as baseline
    from gym as g
    cross join hours as h
    left join public.users as u
      on u.gym_id = g.id
     and u.usual_training_hour = h.hour
    group by h.hour
  ), hourly as (
    select h.hour,
           coalesce(oh.observed, 0) as observed,
           coalesce(bh.baseline, 0) as baseline,
           round((coalesce(oh.observed, 0) + coalesce(bh.baseline, 0) * c.baseline_weight)::numeric, 1) as effective,
           greatest(1::numeric, ceil(coalesce(bhss.busy_threshold, bh.baseline * c.busy_ratio))) as busy_threshold,
           greatest(0::numeric, coalesce(bhss.quiet_threshold, bh.baseline * c.quiet_ratio)) as quiet_threshold
    from hours as h
    cross join gym as g
    cross join config as c
    left join observed_hours as oh on oh.hour = h.hour
    left join baseline_hours as bh on bh.hour = h.hour
    left join public.gym_hourly_occupancy_stats as bhss
      on bhss.gym_id = g.id and bhss.hour_of_day = h.hour
  ), hourly_status as (
    select hour, observed, baseline, effective,
           case
             when effective >= busy_threshold then 'busy'
             when effective <= quiet_threshold then 'quiet'
             else 'open'
           end as status
    from hourly
  ), muscles as (
    select unnest(array['chest', 'back', 'legs', 'arms', 'cardio', 'full body']) as muscle_group
  ), observed_muscles as (
    select unnest(ci.muscle_groups) as muscle_group, count(*)::integer as observed
    from public.check_ins as ci
    join gym as g on g.id = ci.gym_id
    where ci.gym_id = p_gym_id
      and ci.status = 'active'
      and ci.started_at >= (select local_date::timestamp at time zone timezone from now_context cross join gym)
      and ci.started_at < (select now_ts from now_context)
    group by unnest(ci.muscle_groups)
  ), baseline_muscles as (
    select m.muscle_group, count(u.id)::integer as baseline
    from gym as g
    cross join muscles as m
    left join public.users as u
      on u.gym_id = g.id
     and u.usual_muscle_groups @> array[m.muscle_group]
    group by m.muscle_group
  ), muscle_rows as (
    select m.muscle_group,
           coalesce(om.observed, 0) as observed,
           coalesce(bm.baseline, 0) as baseline,
           round((coalesce(om.observed, 0) + coalesce(bm.baseline, 0) * c.baseline_weight)::numeric, 1) as effective
    from muscles as m
    cross join gym as g
    cross join config as c
    left join observed_muscles as om on om.muscle_group = m.muscle_group
    left join baseline_muscles as bm on bm.muscle_group = m.muscle_group
  ), muscle_status as (
    select mr.*,
           case
             when mr.effective >= greatest(1::numeric, ceil(bhss.busy_threshold)) then 'busy'
             when mr.effective <= greatest(0::numeric, floor(bhss.quiet_threshold)) then 'quiet'
             else 'open'
           end as status
    from muscle_rows as mr
    left join public.gym_muscle_hourly_stats as bhss
      on bhss.gym_id = p_gym_id
     and bhss.hour_of_day = (select current_hour from now_context)
     and bhss.muscle_group = mr.muscle_group
  ), suggestions as (
    select
      (select muscle_group from muscle_status order by effective desc, muscle_group limit 1) as busiest_muscle,
      (select muscle_group from muscle_status order by effective asc, muscle_group limit 1) as most_open_muscle,
      max(effective) as peak_effective
    from muscle_status
  )
  select jsonb_build_object(
    'gymId', g.id,
    'now', p_now,
    'localDate', (select local_date from now_context),
    'currentHour', (select current_hour from now_context),
    'hasRealData', exists (
      select 1 from public.check_ins as ci where ci.gym_id = p_gym_id and ci.status = 'active'
    ),
    'hourly', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'hour', hs.hour,
          'observed', hs.observed,
          'baseline', hs.baseline,
          'effective', hs.effective,
          'status', hs.status
        ) order by hs.hour
      )
      from hourly_status as hs
    ), '[]'::jsonb),
    'muscles', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'muscleGroup', ms.muscle_group,
          'observed', ms.observed,
          'baseline', ms.baseline,
          'effective', ms.effective,
          'status', ms.status
        ) order by ms.effective desc, ms.muscle_group
      )
      from muscle_status as ms
    ), '[]'::jsonb),
    'suggestion', case
      when s.peak_effective >= greatest(1::numeric, ceil((select max(busy_threshold) from hourly)))
        then (select busiest_muscle || ' is packed right now; ' || most_open_muscle || ' looks open.' from suggestions)
      else 'The floor looks manageable—choose a muscle group you enjoy.'
    end
  )
  from gym as g
  cross join config as c
  cross join suggestions as s;
$$;

-- V1 realtime events. The deferred screens can add their tables to this publication later.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'check_ins'
  ) then
    alter publication supabase_realtime add table public.check_ins;
  end if;
end;
$$;
