create extension if not exists pgcrypto;

create type public.fieldnote_role as enum ('student', 'instructor', 'admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 80),
  role public.fieldnote_role not null default 'student',
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create function public.create_fieldnote_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'fieldnote_role';
  safe_role public.fieldnote_role := 'student';
begin
  if requested_role = 'instructor' then
    safe_role := 'instructor';
  end if;

  insert into public.profiles (id, full_name, role, profile)
  values (
    new.id,
    coalesce(nullif(left(new.raw_user_meta_data ->> 'full_name', 80), ''), 'Fieldnote learner'),
    safe_role,
    coalesce(new.raw_user_meta_data -> 'fieldnote_profile', '{}'::jsonb)
  );
  return new;
end;
$$;

create trigger fieldnote_auth_user_created
  after insert on auth.users
  for each row execute function public.create_fieldnote_profile();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create table public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  analytics_consent boolean not null default false,
  marketing_consent boolean not null default false,
  terms_version text not null,
  consented_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  instructor_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 1 and 120),
  category text not null check (char_length(category) between 1 and 80),
  description text not null default '' check (char_length(description) <= 1200),
  is_published boolean not null default false,
  course_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index courses_published_created_idx on public.courses (is_published, created_at desc);
create index courses_instructor_idx on public.courses (instructor_id, created_at desc);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  content text not null default '',
  sequence_order integer not null check (sequence_order > 0),
  lesson_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (course_id, sequence_order)
);

create table public.student_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'completed')),
  score numeric(5,2) check (score is null or score between 0 and 100),
  time_spent_seconds integer not null default 0 check (time_spent_seconds >= 0),
  last_accessed_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create index student_progress_student_idx on public.student_progress (student_id, last_accessed_at desc);

create table public.student_learning_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger student_learning_state_updated_at
  before update on public.student_learning_state
  for each row execute function public.touch_updated_at();

create table public.api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0)
);

create function public.consume_api_rate_limit(p_bucket_key text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean := false;
begin
  insert into public.api_rate_limits (bucket_key, window_started_at, request_count)
  values (p_bucket_key, now(), 1)
  on conflict (bucket_key) do update
  set window_started_at = case
        when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
        else public.api_rate_limits.window_started_at
      end,
      request_count = case
        when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
        else public.api_rate_limits.request_count + 1
      end;

  select request_count <= p_limit into allowed
  from public.api_rate_limits
  where bucket_key = p_bucket_key;
  return allowed;
end;
$$;

create table public.security_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.credentials (
  id uuid primary key default gen_random_uuid(),
  jwt text not null,
  criteria text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table public.concept_nodes (
  course_id text not null,
  concept_id text not null,
  title text not null,
  description text not null default '',
  area text not null default 'General',
  prerequisites jsonb not null default '[]'::jsonb,
  minimum_mastery real not null default 0.7 check (minimum_mastery between 0 and 1),
  primary key (course_id, concept_id)
);

create table public.learner_concepts (
  learner_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null,
  concept_id text not null,
  mastery real not null default 0 check (mastery between 0 and 1),
  attempts integer not null default 0 check (attempts >= 0),
  last_score real not null default 0 check (last_score between 0 and 1),
  updated_at timestamptz not null default now(),
  primary key (learner_id, course_id, concept_id),
  foreign key (course_id, concept_id) references public.concept_nodes(course_id, concept_id) on delete cascade
);

create table public.concept_assessments (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null,
  concept_id text not null,
  score real not null check (score between 0 and 1),
  correct boolean not null,
  recorded_at timestamptz not null default now(),
  foreign key (course_id, concept_id) references public.concept_nodes(course_id, concept_id) on delete cascade
);

create table public.review_schedules (
  learner_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null,
  concept_id text not null,
  repetitions integer not null default 0,
  interval_days integer not null default 0,
  ease_factor real not null default 2.5,
  last_quality integer not null default 0 check (last_quality between 0 and 5),
  last_reviewed_at timestamptz not null default now(),
  next_due_at timestamptz not null default now(),
  primary key (learner_id, course_id, concept_id),
  foreign key (learner_id, course_id, concept_id)
    references public.learner_concepts(learner_id, course_id, concept_id) on delete cascade
);

alter table public.profiles enable row level security;
alter table public.user_consents enable row level security;
alter table public.courses enable row level security;
alter table public.lessons enable row level security;
alter table public.student_progress enable row level security;
alter table public.student_learning_state enable row level security;
alter table public.api_rate_limits enable row level security;
alter table public.security_audit_logs enable row level security;
alter table public.credentials enable row level security;
alter table public.concept_nodes enable row level security;
alter table public.learner_concepts enable row level security;
alter table public.concept_assessments enable row level security;
alter table public.review_schedules enable row level security;

create policy "Profiles are readable by their owner"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "Users update their own non-role profile fields"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Users manage their own consents"
  on public.user_consents for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Published courses and own courses are readable"
  on public.courses for select to anon, authenticated
  using (is_published or instructor_id = (select auth.uid()));
create policy "Instructors create courses for themselves"
  on public.courses for insert to authenticated
  with check (
    instructor_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'instructor')
  );
create policy "Instructors update their own courses"
  on public.courses for update to authenticated
  using (instructor_id = (select auth.uid()))
  with check (
    instructor_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'instructor')
  );
create policy "Instructors delete their own courses"
  on public.courses for delete to authenticated
  using (instructor_id = (select auth.uid()));

create policy "Lessons follow course visibility"
  on public.lessons for select to anon, authenticated
  using (exists (
    select 1 from public.courses c
    where c.id = course_id and (c.is_published or c.instructor_id = (select auth.uid()))
  ));
create policy "Course owners manage lessons"
  on public.lessons for all to authenticated
  using (exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = (select auth.uid())))
  with check (exists (select 1 from public.courses c where c.id = course_id and c.instructor_id = (select auth.uid())));

create policy "Students manage only their own progress"
  on public.student_progress for all to authenticated
  using (
    student_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'student')
  )
  with check (
    student_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'student')
  );
create policy "Users manage their own dashboard state"
  on public.student_learning_state for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users can read their audit events"
  on public.security_audit_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users read their own learner concept state"
  on public.learner_concepts for select to authenticated
  using (learner_id = (select auth.uid()));
create policy "Users read their own concept assessments"
  on public.concept_assessments for select to authenticated
  using (learner_id = (select auth.uid()));
create policy "Users read their own review schedules"
  on public.review_schedules for select to authenticated
  using (learner_id = (select auth.uid()));
create policy "Concept graphs are readable"
  on public.concept_nodes for select to anon, authenticated
  using (true);

revoke all on public.profiles, public.user_consents, public.courses, public.lessons,
  public.student_progress, public.student_learning_state, public.api_rate_limits,
  public.security_audit_logs, public.credentials,
  public.concept_nodes, public.learner_concepts, public.concept_assessments,
  public.review_schedules from anon;
grant select on public.courses, public.lessons, public.concept_nodes to anon;
revoke all on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, profile) on public.profiles to authenticated;
grant select, insert, update, delete on public.user_consents, public.student_progress to authenticated;
grant select, insert, update, delete on public.student_learning_state to authenticated;
grant select, insert, update, delete on public.courses, public.lessons to authenticated;
grant select on public.security_audit_logs, public.learner_concepts,
  public.concept_assessments, public.review_schedules to authenticated;
grant select on public.concept_nodes to authenticated;
grant all on public.profiles, public.user_consents, public.courses, public.lessons,
  public.student_progress, public.student_learning_state, public.api_rate_limits,
  public.security_audit_logs, public.credentials,
  public.concept_nodes, public.learner_concepts, public.concept_assessments,
  public.review_schedules to service_role;
revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

create function public.is_fieldnote_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
