create extension if not exists pgcrypto;

create table if not exists public.tracker_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.tracker_backups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  kind text not null check (kind in ('daily', 'manual')),
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  timezone text not null default 'Europe/Istanbul',
  plan_time time not null default '09:00',
  report_time time not null default '21:00',
  last_plan_sent date,
  last_report_sent date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tracker_state enable row level security;
alter table public.tracker_backups enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "Users manage own tracker state" on public.tracker_state
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own tracker backups" on public.tracker_backups
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own push subscriptions" on public.push_subscriptions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tracker_state_updated_at on public.tracker_state;
create trigger tracker_state_updated_at before update on public.tracker_state
for each row execute function public.set_updated_at();
drop trigger if exists push_subscriptions_updated_at on public.push_subscriptions;
create trigger push_subscriptions_updated_at before update on public.push_subscriptions
for each row execute function public.set_updated_at();

-- İsteğe bağlı: anlık güncelleme için Dashboard → Realtime → Publications altında
-- tracker_state tablosunu supabase_realtime yayınına ekleyin.
