-- RBAC, part two: delegation, communities as real rows, and the audit trails that
-- make both of them answerable.
--
-- Three things this fixes:
--  1. communities only existed on the member's phone, so nothing about who runs
--     one could be enforced anywhere;
--  2. a community's managers were stored as display names, which anyone could
--     impersonate by renaming himself — they are user ids here;
--  3. handing out rights, and a club owner opening a private community, both
--     happened with no record. Every one is written down now.

-- ── delegation ──────────────────────────────────────────────────────────────
-- 'manage_staff' lets a manager hand out the other rights. The application
-- refuses to grant what the granter does not hold, and refuses to pass on
-- manage_staff itself; this constraint only widens the allowed set.
alter table public.staff_permissions drop constraint if exists staff_permissions_permission_check;
alter table public.staff_permissions add constraint staff_permissions_permission_check
  check (permission in (
    'manage_classes', 'manage_products', 'manage_announcements',
    'manage_coaches', 'validate_records', 'manage_staff',
    -- Each of these guards something the club manager alone could do before:
    -- removing members, moderating the Wall, the room settings, and the numbers.
    'manage_members', 'moderate_wall', 'manage_floor', 'view_analytics'
  ));

-- Who gave what to whom, and who took it back. Append-only: revoking writes a
-- second row rather than deleting the first, so the history survives.
create table if not exists public.permission_grants (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  permission text not null,
  granted boolean not null, -- false = revoked
  at timestamptz not null default now()
);
create index if not exists permission_grants_gym_idx on public.permission_grants (gym_id, at desc);

-- ── communities ─────────────────────────────────────────────────────────────
create table if not exists public.communities (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  slug text not null,
  name text not null check (length(btrim(name)) between 2 and 40),
  initials text not null,
  color text not null default 'teal',
  type text not null default 'open' check (type in ('official', 'open', 'request', 'invite')),
  women_only boolean not null default false,
  description text not null default '',
  rules text[] not null default '{}',
  -- The founder. Never null: a community without someone answerable for it is
  -- exactly the state this table exists to prevent.
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (gym_id, slug)
);
create index if not exists communities_gym_idx on public.communities (gym_id) where archived_at is null;

-- One row per person per community: their standing, and the ban reason if any.
create table if not exists public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'member'
    check (status in ('pending', 'member', 'mod', 'admin', 'banned')),
  -- 'founder' is deliberately absent: it is communities.created_by, so it cannot
  -- be edited by a management action and there is only ever one.
  ban_reason text,
  acted_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index if not exists community_members_pending_idx
  on public.community_members (community_id) where status = 'pending';

-- Moderation and break-glass, in the open. The club owner may read a private
-- community because he answers for his club, but never silently: this row is
-- shown to that community's members.
create table if not exists public.community_audit (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in (
    'created', 'accepted', 'refused', 'banned', 'unbanned',
    'promoted', 'demoted', 'transferred', 'owner_override', 'archived'
  )),
  reason text,
  at timestamptz not null default now()
);
create index if not exists community_audit_idx on public.community_audit (community_id, at desc);

-- ── row level security ──────────────────────────────────────────────────────
alter table public.communities enable row level security;
alter table public.community_members enable row level security;
alter table public.community_audit enable row level security;
alter table public.permission_grants enable row level security;

-- A community is visible when it is not invite-only, or when you belong to it.
drop policy if exists communities_visible on public.communities;
create policy communities_visible on public.communities
  for select using (
    type <> 'invite'
    or exists (
      select 1 from public.community_members m
      where m.community_id = communities.id
        and m.user_id = auth.uid()
        and m.status in ('member', 'mod', 'admin')
    )
    or created_by = auth.uid()
  );

-- You can always read your own membership row; managers read the whole list.
drop policy if exists community_members_read on public.community_members;
create policy community_members_read on public.community_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.community_members me
      where me.community_id = community_members.community_id
        and me.user_id = auth.uid()
        and me.status in ('mod', 'admin')
    )
    or exists (select 1 from public.communities c where c.id = community_id and c.created_by = auth.uid())
  );

-- The audit trail is readable by the community's members: being watched is only
-- a safeguard if the watched can see it.
drop policy if exists community_audit_read on public.community_audit;
create policy community_audit_read on public.community_audit
  for select using (
    exists (
      select 1 from public.community_members m
      where m.community_id = community_audit.community_id
        and m.user_id = auth.uid()
        and m.status in ('member', 'mod', 'admin')
    )
  );

-- Grant history is staff business, never a member's.
drop policy if exists permission_grants_read on public.permission_grants;
create policy permission_grants_read on public.permission_grants
  for select using (
    target_user_id = auth.uid()
    or exists (
      select 1 from public.staff_permissions sp
      where sp.user_id = auth.uid() and sp.permission = 'manage_staff'
    )
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'owner')
  );
