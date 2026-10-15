-- Gym App backend schema (v1).
--
-- Source of truth for the database. The Node API (backend/) mirrors these
-- tables in backend/src/shared/db/schema.ts and is the only writer: the app's
-- anon/authenticated keys get read access to a few rows through RLS (live
-- floor over Realtime, own profile) and nothing else.
--
-- Money is stored as integer millimes (1 TND = 1000 millimes).
-- Every business table carries gym_id so one deployment can serve many clubs.

-- ─────────────────────────────── clubs ───────────────────────────────

create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null check (length(btrim(name)) between 2 and 80),
  city text,
  country text not null default 'TN',
  timezone text not null default 'Africa/Tunis',
  currency text not null default 'TND',
  logo_url text,
  primary_color text not null default '#0284C7',
  opening_hour smallint not null default 6 check (opening_hour between 0 and 23),
  closing_hour smallint not null default 22 check (closing_hour between 1 and 24),
  max_capacity integer not null default 80 check (max_capacity > 0),
  classes_enabled boolean not null default true,
  enforce_memberships boolean not null default false,
  check_in_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────── identity ───────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'coach', 'owner')),
  full_name text not null check (length(btrim(full_name)) between 2 and 60),
  gender text check (gender in ('male', 'female')),
  birth_year smallint check (birth_year between 1920 and 2020),
  goal text,
  training_slot text check (training_slot in ('morning', 'afternoon', 'evening')),
  usual_muscles text[] not null default '{}',
  avatar_url text,
  bio text check (length(bio) <= 300),
  whatsapp text check (whatsapp ~ '^[0-9]{8,15}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_gym_role_idx on public.profiles (gym_id, role);

create table public.staff_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  permission text not null check (permission in (
    'manage_classes', 'manage_products', 'manage_announcements', 'manage_coaches', 'validate_records'
  )),
  granted_by uuid references public.profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, permission)
);

-- ─────────────────────────────── clubs (cont.) ───────────────────────────────

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  kind text not null default 'info' check (kind in ('aid', 'iftar', 'closure', 'hours', 'event', 'info')),
  title text not null check (length(btrim(title)) between 2 and 80),
  message text not null check (length(message) <= 1000),
  when_label text,
  urgent boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index announcements_gym_idx on public.announcements (gym_id, created_at desc);

-- ─────────────────────────────── memberships ───────────────────────────────

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_name text not null default 'Mensuel',
  starts_on date not null,
  ends_on date not null,
  price_millimes integer not null default 0 check (price_millimes >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index memberships_user_idx on public.memberships (user_id, ends_on desc);

-- ─────────────────────────────── attendance ───────────────────────────────

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  muscles text[] not null default '{}',
  source text not null default 'door_qr' check (source in ('door_qr', 'manual')),
  status text not null default 'active' check (status in ('active', 'completed', 'expired')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  local_day date not null,
  check (ended_at is null or ended_at >= started_at)
);
create index check_ins_gym_started_idx on public.check_ins (gym_id, started_at desc);
create index check_ins_user_day_idx on public.check_ins (user_id, local_day desc);
create unique index check_ins_one_active_per_user on public.check_ins (user_id) where status = 'active';

-- ─────────────────────────────── classes ───────────────────────────────

create table public.group_classes (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  title text not null check (length(btrim(title)) between 2 and 60),
  coach_id uuid references public.profiles(id) on delete set null,
  weekday smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  start_time time not null,
  duration_min smallint not null check (duration_min between 10 and 240),
  capacity smallint not null check (capacity between 1 and 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index group_classes_gym_idx on public.group_classes (gym_id, weekday, start_time);

create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  class_id uuid not null references public.group_classes(id) on delete cascade,
  session_date date not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  cancel_reason text,
  cancelled_by uuid references public.profiles(id) on delete set null,
  unique (class_id, session_date)
);

create table public.class_bookings (
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  booked_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- ─────────────────────────────── coaching ───────────────────────────────

create table public.coach_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  headline text,
  bio text not null default '',
  specialties text[] not null default '{}',
  years_experience smallint not null default 0 check (years_experience between 0 and 60),
  certifications text[] not null default '{}',
  availability_days smallint[] not null default '{}',
  availability_hours text,
  accepting_clients boolean not null default true,
  floor_coach boolean not null default false,
  live_state text check (live_state in ('here', 'away')),
  live_state_at timestamptz,
  banner_url text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index coach_profiles_gym_status_idx on public.coach_profiles (gym_id, status);

create table public.coach_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(user_id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  title text not null,
  price_millimes integer not null check (price_millimes >= 0),
  billing_period text not null,
  features text[] not null default '{}',
  popular boolean not null default false,
  position smallint not null default 0
);

create table public.coach_transformations (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.coach_profiles(user_id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  client_name text not null,
  before_url text not null,
  after_url text not null,
  duration text not null,
  result text not null,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────── community ───────────────────────────────

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'chat' check (category in ('chat', 'workout', 'meal', 'pr', 'question')),
  caption text not null default '' check (length(caption) <= 2000),
  image_urls text[] not null default '{}',
  pr jsonb, -- { exercise, weightKg, reps, previousKg? } when category = 'pr'
  pr_validated_by uuid references public.profiles(id) on delete set null,
  pr_validated_at timestamptz,
  comments_disabled boolean not null default false,
  likes_hidden boolean not null default false,
  resolved boolean not null default false,
  status text not null default 'published' check (status in ('published', 'removed')),
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz not null default now(),
  check (category <> 'pr' or pr is not null)
);
create index posts_gym_feed_idx on public.posts (gym_id, created_at desc) where status = 'published';

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  text text not null check (length(btrim(text)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index post_comments_post_idx on public.post_comments (post_id, created_at);

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (length(btrim(reason)) between 2 and 300),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

-- ─────────────────────────────── journal ───────────────────────────────

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid references public.gyms(id) on delete cascade,   -- null = global catalogue
  owner_id uuid references public.profiles(id) on delete cascade, -- set = a member's custom exercise
  name text not null check (length(btrim(name)) between 2 and 60),
  muscle text not null check (muscle in ('chest', 'back', 'shoulders', 'arms', 'legs', 'cardio')),
  kind text not null default 'strength' check (kind in ('strength', 'cardio'))
);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  weight_kg numeric(6,2) not null default 0 check (weight_kg >= 0),
  reps smallint not null default 0 check (reps between 0 and 500),
  minutes smallint not null default 0 check (minutes between 0 and 600),
  performed_at timestamptz not null default now(),
  local_day date not null
);
create index workout_sets_user_idx on public.workout_sets (user_id, performed_at desc);

-- ─────────────────────────────── shop ───────────────────────────────

create table public.products (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  category text not null check (category in ('Protéine', 'Gainer', 'Multivitamines', 'Pre-Workout', 'Accessoires', 'Snacks & Boissons')),
  description text not null default '',
  price_millimes integer not null check (price_millimes >= 0),
  original_price_millimes integer check (original_price_millimes >= 0),
  image_urls text[] not null default '{}',
  in_stock boolean not null default true,
  low_stock boolean not null default false,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_gym_idx on public.products (gym_id) where archived_at is null;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  quantity smallint not null check (quantity between 1 and 20),
  unit_price_millimes integer not null check (unit_price_millimes >= 0),
  status text not null default 'pending' check (status in ('pending', 'ready', 'picked_up', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reservations_gym_status_idx on public.reservations (gym_id, status, created_at desc);

-- ─────────────────────────────── notifications ───────────────────────────────

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  type text not null,
  title text not null,
  body text not null default '',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- ─────────────────────────────── updated_at ───────────────────────────────

create function public.set_updated_at() returns trigger
language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger gyms_updated_at before update on public.gyms for each row execute function public.set_updated_at();
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger coach_profiles_updated_at before update on public.coach_profiles for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger reservations_updated_at before update on public.reservations for each row execute function public.set_updated_at();

-- ─────────────────────────────── row level security ───────────────────────────────
-- The API connects as the table owner and is not subject to these policies.
-- Clients get read-only access to exactly what they need to subscribe to.

alter table public.gyms enable row level security;
alter table public.profiles enable row level security;
alter table public.staff_permissions enable row level security;
alter table public.announcements enable row level security;
alter table public.memberships enable row level security;
alter table public.check_ins enable row level security;
alter table public.group_classes enable row level security;
alter table public.class_sessions enable row level security;
alter table public.class_bookings enable row level security;
alter table public.coach_profiles enable row level security;
alter table public.coach_plans enable row level security;
alter table public.coach_transformations enable row level security;
alter table public.posts enable row level security;
alter table public.post_comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_reports enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_sets enable row level security;
alter table public.products enable row level security;
alter table public.reservations enable row level security;
alter table public.notifications enable row level security;
alter table public.push_devices enable row level security;

create function public.current_gym_id() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select gym_id from public.profiles where id = auth.uid();
$$;

create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

-- Live floor: members of a gym see that gym's check-ins change in real time.
create policy "read own gym check-ins" on public.check_ins
  for select to authenticated using (gym_id = public.current_gym_id());

-- New in-app notifications arrive over Realtime too.
create policy "read own notifications" on public.notifications
  for select to authenticated using (recipient_id = auth.uid());

-- ─────────────────────────────── realtime ───────────────────────────────

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.check_ins, public.notifications;
  end if;
end;
$$;

-- ─────────────────────────────── storage ───────────────────────────────
-- Public-read buckets; uploads only through signed URLs created by the API.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true), ('posts', 'posts', true), ('products', 'products', true), ('coaches', 'coaches', true)
on conflict (id) do nothing;

-- ─────────────────────────────── seed: exercise catalogue ───────────────────────────────

insert into public.exercises (name, muscle, kind) values
  ('Développé couché', 'chest', 'strength'),
  ('Développé incliné haltères', 'chest', 'strength'),
  ('Écarté poulie', 'chest', 'strength'),
  ('Tractions', 'back', 'strength'),
  ('Tirage vertical', 'back', 'strength'),
  ('Rowing barre', 'back', 'strength'),
  ('Soulevé de terre', 'back', 'strength'),
  ('Développé militaire', 'shoulders', 'strength'),
  ('Élévations latérales', 'shoulders', 'strength'),
  ('Curl barre', 'arms', 'strength'),
  ('Extension triceps poulie', 'arms', 'strength'),
  ('Squat', 'legs', 'strength'),
  ('Presse à cuisses', 'legs', 'strength'),
  ('Fentes', 'legs', 'strength'),
  ('Leg curl', 'legs', 'strength'),
  ('Tapis de course', 'cardio', 'cardio'),
  ('Vélo', 'cardio', 'cardio'),
  ('Rameur', 'cardio', 'cardio');
