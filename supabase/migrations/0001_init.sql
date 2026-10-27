-- ============================================================
-- NEXUS — 0001: Үндсэн бүтэц + Row Level Security (RLS)
-- Ашиглах:
--   a) Supabase Dashboard → SQL Editor → энэ файлын агуулгыг хуулаад Run, эсвэл
--   b) Supabase CLI: supabase link && supabase db push
-- Давхардсан хүснэгт үүсгэхгүйн тулд бүгд IF NOT EXISTS.
-- ============================================================

-- Хэрэглэгчийн профайл (зөвхөн нэр, имэйл — эмзэг мэдээлэл байхгүй)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now()
);

-- Шинэ бүртгэлээс профайл автоматаар үүсгэх
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Тестийн үр дүн
create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  assessment_type text not null default 'quick-15',
  total_score int not null,
  max_score int,
  raw_score int,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Тухайн тестийн асуулт бүрийн хариулт
create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  question_id int not null,
  answer text,
  score int,
  skill_name text,
  created_at timestamptz not null default now()
);

-- Чадвар бүрийн дүн
create table if not exists public.skill_results (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments (id) on delete cascade,
  skill_name text not null,
  score int not null,
  raw_score int,
  max_raw int,
  feedback text
);

-- Дасгалын сан (зөвхөн admin/сэрвис-рүү бичнэ; хэрэглэгч уншина)
create table if not exists public.exercises (
  id text primary key,
  title text not null,
  skill_name text not null,
  difficulty text,
  minutes int,
  content jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- Хэрэглэгчийн дасгалын явц
create table if not exists public.exercise_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  status text not null default 'completed',
  score int,
  completed_at timestamptz not null default now(),
  unique (user_id, exercise_id)
);

-- AI хэрэглээний тэмдэглэл (өдрийн хязгаарлалтад ашиглана)
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null default 'guide',
  created_at timestamptz not null default now()
);

-- Индексүүд
create index if not exists idx_assessments_user on public.assessments (user_id, completed_at desc);
create index if not exists idx_answers_assessment on public.assessment_answers (assessment_id);
create index if not exists idx_skill_results_assessment on public.skill_results (assessment_id);
create index if not exists idx_ex_progress_user on public.exercise_progress (user_id);
create index if not exists idx_ai_logs_user_day on public.ai_usage_logs (user_id, created_at);

-- ============================================================
-- RLS ИДЭВХЖҮҮЛЭХ
-- ============================================================
alter table public.profiles enable row level security;
alter table public.assessments enable row level security;
alter table public.assessment_answers enable row level security;
alter table public.skill_results enable row level security;
alter table public.exercises enable row level security;
alter table public.exercise_progress enable row level security;
alter table public.ai_usage_logs enable row level security;

-- profiles: зөвхөн өөрийнхөө харж, засна
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- assessments: зөвхөн өөрийн үр дүн
drop policy if exists "assessments_select_own" on public.assessments;
create policy "assessments_select_own" on public.assessments
  for select using (auth.uid() = user_id);
drop policy if exists "assessments_insert_own" on public.assessments;
create policy "assessments_insert_own" on public.assessments
  for insert with check (auth.uid() = user_id);
drop policy if exists "assessments_delete_own" on public.assessments;
create policy "assessments_delete_own" on public.assessments
  for delete using (auth.uid() = user_id);

-- assessment_answers: зөвхөн өөрийн assessment-ийн хариулт
drop policy if exists "answers_select_own" on public.assessment_answers;
create policy "answers_select_own" on public.assessment_answers
  for select using (exists (
    select 1 from public.assessments a
    where a.id = assessment_id and a.user_id = auth.uid()
  ));
drop policy if exists "answers_insert_own" on public.assessment_answers;
create policy "answers_insert_own" on public.assessment_answers
  for insert with check (exists (
    select 1 from public.assessments a
    where a.id = assessment_id and a.user_id = auth.uid()
  ));

-- skill_results: answers адил
drop policy if exists "skills_select_own" on public.skill_results;
create policy "skills_select_own" on public.skill_results
  for select using (exists (
    select 1 from public.assessments a
    where a.id = assessment_id and a.user_id = auth.uid()
  ));
drop policy if exists "skills_insert_own" on public.skill_results;
create policy "skills_insert_own" on public.skill_results
  for insert with check (exists (
    select 1 from public.assessments a
    where a.id = assessment_id and a.user_id = auth.uid()
  ));

-- exercises: нийтлэг уншилт (зөвхөн нийтлэгдсэн), бичлэг client биш
drop policy if exists "exercises_read_published" on public.exercises;
create policy "exercises_read_published" on public.exercises
  for select using (is_published = true);

-- exercise_progress: зөвхөн өөрийнх (бүрэн CRUD өөрөө)
drop policy if exists "ex_progress_all_own" on public.exercise_progress;
create policy "ex_progress_all_own" on public.exercise_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ai_usage_logs: унших/нэмэх зөвхөн өөрөө (Edge Function хэрэглэгчийн токен ашиглана)
drop policy if exists "ai_logs_select_own" on public.ai_usage_logs;
create policy "ai_logs_select_own" on public.ai_usage_logs
  for select using (auth.uid() = user_id);
drop policy if exists "ai_logs_insert_own" on public.ai_usage_logs;
create policy "ai_logs_insert_own" on public.ai_usage_logs
  for insert with check (auth.uid() = user_id);

-- Бүртгэл үүсгэхэд профайл шууд үүсдэг болохыг баталгаажуулах
-- (trigger дээр дурдсан — profiles-ийг client биш trigger бичнэ)
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.assessments to authenticated;
grant select, insert on public.assessment_answers, public.skill_results to authenticated;
grant select on public.exercises to authenticated;
grant select, insert, update, delete on public.exercise_progress to authenticated;
grant select, insert on public.ai_usage_logs to authenticated;
