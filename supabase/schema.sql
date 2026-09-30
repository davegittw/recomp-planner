-- Recomp Planner schema. Run once in the Supabase SQL editor of a new project.
-- One table holds every document (exercises, foods, workouts, days, settings) as JSON,
-- so new fields can be added in the app without migrations.

create table if not exists public.records (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('exercises','foods','workouts','days','settings')),
  id         text not null,
  data       jsonb,
  deleted    boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, id)
);

create index if not exists records_user_updated on public.records (user_id, updated_at);

-- The server sets the timestamp, so sync never depends on the phone's clock.
create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
for each row execute function public.records_touch();

-- Only the signed-in owner can see or change their rows.
alter table public.records enable row level security;

drop policy if exists "own records" on public.records;
create policy "own records" on public.records
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.records from anon;

-- Handy views for querying your data in SQL later (they respect RLS).
create or replace view public.workout_log with (security_invoker = true) as
select r.user_id,
       (r.id)::date                         as day,
       l.key                                as exercise_id,
       e.data->>'name'                      as exercise,
       s.ord                                as set_no,
       nullif(s.val->>'w','')::numeric      as weight_kg,
       nullif(regexp_replace(s.val->>'r','[^0-9]','','g'),'')::int as reps
from public.records r
cross join lateral jsonb_each(coalesce(r.data->'log','{}'::jsonb)) l
cross join lateral jsonb_array_elements(l.value) with ordinality s(val, ord)
left join public.records e on e.user_id = r.user_id and e.kind = 'exercises' and e.id = l.key and not e.deleted
where r.kind = 'days' and not r.deleted and (s.val->>'done')::boolean;

create or replace view public.daily_nutrition with (security_invoker = true) as
select r.user_id,
       (r.id)::date as day,
       round(sum((m->>'kcal')::numeric * (m->>'qty')::numeric / nullif((m->>'size')::numeric,0)) filter (where (m->>'eaten')::boolean)) as kcal_eaten,
       round(sum((m->>'p')::numeric    * (m->>'qty')::numeric / nullif((m->>'size')::numeric,0)) filter (where (m->>'eaten')::boolean), 1) as protein_eaten,
       round(sum((m->>'kcal')::numeric * (m->>'qty')::numeric / nullif((m->>'size')::numeric,0))) as kcal_planned,
       round(sum((m->>'p')::numeric    * (m->>'qty')::numeric / nullif((m->>'size')::numeric,0)), 1) as protein_planned
from public.records r
cross join lateral jsonb_array_elements(coalesce(r.data->'meals','[]'::jsonb)) m
where r.kind = 'days' and not r.deleted
group by r.user_id, r.id;
