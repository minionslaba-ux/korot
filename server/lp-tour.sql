-- Лесная почта: еженедельный турнир (проект Supabase auequuxfcwdshblqrwbd)
create table if not exists public.lp_tour_scores (
  week int not null,
  pid text not null,
  name text not null,
  score int not null default 0,
  plays int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (week, pid)
);
create index if not exists lp_tour_scores_week_score on public.lp_tour_scores (week, score desc);
alter table public.lp_tour_scores enable row level security;
-- прямого доступа нет: всё через функцию lp-tour (service role)

create or replace function public.lp_tour_submit(p_week int, p_pid text, p_name text, p_score int)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into lp_tour_scores(week,pid,name,score,plays,updated_at) values (p_week,p_pid,p_name,p_score,1,now())
  on conflict (week,pid) do update set
    score = greatest(lp_tour_scores.score, excluded.score),
    name = excluded.name,
    plays = lp_tour_scores.plays + 1,
    updated_at = now();
end $$;
revoke all on function public.lp_tour_submit(int,text,text,int) from public, anon, authenticated;

create or replace function public.lp_tour_rank(p_week int, p_pid text)
returns table(rank bigint, score int, total bigint) language sql security definer set search_path = public as $$
  select (select count(*) from lp_tour_scores s2 where s2.week=p_week and s2.score > s.score) + 1,
         s.score,
         (select count(*) from lp_tour_scores s3 where s3.week=p_week)
  from lp_tour_scores s where s.week=p_week and s.pid=p_pid;
$$;
revoke all on function public.lp_tour_rank(int,text) from public, anon, authenticated;

-- учёт выданных призов (выдаёт только сервер, один раз на игрока за неделю)
create table if not exists public.lp_tour_claims (
  week int not null,
  pid text not null,
  rank int not null,
  prize int not null,
  claimed_at timestamptz not null default now(),
  primary key (week, pid)
);
alter table public.lp_tour_claims enable row level security;

create or replace function public.lp_tour_claim(p_week int, p_pid text)
returns int language plpgsql security definer set search_path = public as $$
declare r bigint; pz int; n int;
begin
  select (select count(*) from lp_tour_scores s2 where s2.week=p_week and s2.score > s.score) + 1 into r
  from lp_tour_scores s where s.week=p_week and s.pid=p_pid;
  if r is null then return 0; end if;
  pz := case when r=1 then 500 when r<=3 then 300 when r<=10 then 150 when r<=50 then 60 else 20 end;
  insert into lp_tour_claims(week,pid,rank,prize) values (p_week,p_pid,r,pz) on conflict (week,pid) do nothing;
  get diagnostics n = row_count;
  if n=0 then return -1; end if;
  return pz;
end $$;
revoke all on function public.lp_tour_claim(int,text) from public, anon, authenticated;
