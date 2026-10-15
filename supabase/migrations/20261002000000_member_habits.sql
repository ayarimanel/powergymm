-- "Bienvenue" questionnaire: a member's declared habits and his own estimate of
-- when he paid. One row per member per club.
--
-- The payment dates here are DECLARED by the member, never proof of payment:
-- `paid_at_source` says whether he confirmed a renewal ('confirmed') or the app
-- guessed from a one-tap answer ('estimate'), and `paid_at_margin_days` says how
-- wrong the guess may be. Staff views must label them "déclaré" and must never
-- block access on them — the memberships table remains the only billing truth.

create table if not exists public.member_profiles (
  gym_id uuid not null references public.gyms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,

  -- habits (cards 1-4)
  usual_days smallint[] not null default '{}', -- 0 = Monday … 6 = Sunday
  usual_days_varies boolean not null default false,
  usual_slot text check (usual_slot in ('early', 'morning', 'noon', 'afternoon', 'evening', 'late', 'varies')),
  training_style text check (training_style in ('split', 'upper_lower', 'full_body', 'cardio', 'classes', 'beginner')),
  focus_muscles text[] not null default '{}',

  -- subscription, as the member remembers it (cards 5-6)
  subscription_paid_at date,
  subscription_paid_at_source text check (subscription_paid_at_source in ('estimate', 'confirmed')),
  subscription_paid_at_margin_days smallint not null default 0,
  subscription_duration text check (subscription_duration in ('1m', '3m', '6m', '1y', 'pass')),
  subscription_ends_at date,

  -- questionnaire state
  onboarding_status text not null default 'new' check (onboarding_status in ('new', 'partial', 'done', 'snoozed')),
  onboarding_snooze_count smallint not null default 0,
  onboarding_next_at date,
  habits_check_asked_at date,
  renewal_reminders_sent smallint not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (gym_id, user_id)
);

-- The daily job walks memberships that end soon; without this it scans the table.
create index if not exists member_profiles_ends_idx
  on public.member_profiles (gym_id, subscription_ends_at)
  where subscription_ends_at is not null;

-- The calm-alert job looks up "who usually comes at this slot".
create index if not exists member_profiles_slot_idx on public.member_profiles (gym_id, usual_slot);

-- Club settings the questionnaire reads.
alter table public.gyms add column if not exists open_days smallint[] not null default '{0,1,2,3,4,5,6}';
alter table public.gyms add column if not exists durations_sold text[] not null default '{1m,3m,6m,1y,pass}';
alter table public.gyms add column if not exists end_of_month_billing boolean not null default false;

-- A member may read and write only his own row; nobody reads anyone else's.
alter table public.member_profiles enable row level security;

drop policy if exists member_profiles_own_select on member_profiles;
create policy member_profiles_own_select on member_profiles
  for select using (user_id = auth.uid());

drop policy if exists member_profiles_own_write on member_profiles;
create policy member_profiles_own_write on member_profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
