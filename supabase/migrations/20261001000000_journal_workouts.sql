-- ─────────────────────────────── journal v2: workouts logged set by set ───────────────────────────────
-- The member logs each set (kg × reps, or minutes + km) and the app computes everything else.
-- Ids are created on the phone (offline first) and stored as-is, so every write can be replayed safely.
-- Exercise ids are the app's catalogue ids ("chest-bench") or a member's own exercise (uuid), hence text.

alter table public.workout_sets rename to legacy_workout_sets;
alter index public.workout_sets_user_idx rename to legacy_workout_sets_user_idx;

create table public.workouts (
  id uuid primary key,
  gym_id uuid not null references public.gyms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  date timestamptz not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  live boolean not null default true,          -- logged at the club (timer) vs. noted for a past day
  migrated boolean not null default false,     -- converted from the old journal
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index workouts_user_date_idx on public.workouts (user_id, date desc) where deleted_at is null;

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id text not null check (length(exercise_id) between 1 and 64),
  muscle text check (muscle in ('chest', 'back', 'shoulders', 'arms', 'legs', 'cardio')),
  "order" smallint not null,                   -- position in the workout (exercise order follows)
  kg numeric(8,2) not null default 0 check (kg >= 0),
  reps smallint not null default 0 check (reps >= 0),
  minutes numeric(5,1) not null default 0 check (minutes >= 0),
  km numeric(6,2) not null default 0 check (km >= 0),
  is_pr boolean not null default false,        -- computed by the server, never sent by the member
  legacy boolean not null default false        -- a total typed in the old journal: volume only, never a record
);
create index workout_sets_workout_idx on public.workout_sets (workout_id, "order");
create index workout_sets_exercise_idx on public.workout_sets (exercise_id);

create table public.custom_exercises (
  id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  muscle text not null check (muscle in ('chest', 'back', 'shoulders', 'arms', 'legs', 'cardio')),
  name text not null check (length(btrim(name)) between 2 and 40),
  kind text not null check (kind in ('weight', 'body', 'cardio')),
  created_at timestamptz not null default now()
);
create unique index custom_exercises_name_uniq on public.custom_exercises (user_id, muscle, lower(btrim(name)));

alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.custom_exercises enable row level security;

-- ─────────────── migrate the old journal ───────────────

-- Members' own exercises keep their id.
insert into public.custom_exercises (id, user_id, muscle, name, kind)
select e.id, e.owner_id, e.muscle, left(btrim(e.name), 40), case when e.kind = 'cardio' then 'cardio' else 'weight' end
from public.exercises e
where e.owner_id is not null and length(btrim(e.name)) >= 2
on conflict do nothing;

-- Global catalogue → the app's exercise ids.
create temporary table journal_id_map (name text primary key, app_id text not null);
insert into journal_id_map values
  ('Développé couché', 'chest-bench'), ('Développé incliné haltères', 'chest-incline-dumbbell'), ('Écarté poulie', 'chest-cable-fly'),
  ('Tractions', 'back-pullups'), ('Tirage vertical', 'back-pulldown'), ('Rowing barre', 'back-row-bar'), ('Soulevé de terre', 'back-deadlift'),
  ('Développé militaire', 'sh-military'), ('Élévations latérales', 'sh-lateral'),
  ('Curl barre', 'arms-curl-bar'), ('Extension triceps poulie', 'arms-pushdown'),
  ('Squat', 'legs-squat'), ('Presse à cuisses', 'legs-press'), ('Fentes', 'legs-lunges'), ('Leg curl', 'legs-curl'),
  ('Tapis de course', 'cardio-treadmill'), ('Vélo', 'cardio-bike'), ('Rameur', 'cardio-rower');

-- One workout per member and training day.
create temporary table journal_day_map as
select gen_random_uuid() as workout_id, user_id, gym_id, local_day, min(performed_at) as first_at
from public.legacy_workout_sets
group by user_id, gym_id, local_day;

insert into public.workouts (id, gym_id, user_id, date, started_at, ended_at, live, migrated)
select workout_id, gym_id, user_id, first_at, first_at, first_at, false, true from journal_day_map;

-- One set per old entry. A single "rep" with a weight was the total the member typed: kept as volume only.
insert into public.workout_sets (workout_id, exercise_id, muscle, "order", kg, reps, minutes, km, legacy)
select d.workout_id,
       coalesce(case when e.owner_id is null then m.app_id end, e.id::text),
       e.muscle,
       (row_number() over (partition by d.workout_id order by s.performed_at, s.id))::smallint - 1,
       s.weight_kg,
       case when s.minutes > 0 then 0 else s.reps end,
       s.minutes,
       0,
       s.minutes = 0 and s.reps <= 1 and s.weight_kg > 0
from public.legacy_workout_sets s
join journal_day_map d on d.user_id = s.user_id and d.local_day = s.local_day and d.gym_id = s.gym_id
join public.exercises e on e.id = s.exercise_id
left join journal_id_map m on m.name = e.name;

drop table journal_id_map, journal_day_map;
