create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  code text primary key,
  name text not null,
  price numeric(10, 2) not null,
  duration_days integer not null,
  benefits text[] not null default '{}'
);

insert into public.plans (code, name, price, duration_days, benefits) values
  ('weekly', '7天体验', 9.90, 7, array['每日晨报', '周报', '供需数据卡']),
  ('monthly', '月度研究', 29.90, 30, array['每日晨报', '事件提醒', '关注清单', '报告库']),
  ('quarterly', '季度研究', 79.00, 90, array['每日晨报', '季度专题', '报告库', '关注清单'])
on conflict (code) do nothing;

-- 已有项目同步体验套餐名称，不改变价格和有效期。
update public.plans set name = '7天体验' where code = 'weekly';

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.plans(code),
  status text not null default 'pending' check (status in ('pending', 'active', 'expired', 'rejected')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscriptions_user_status_idx on public.subscriptions (user_id, status, ends_at);

create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null references public.plans(code),
  amount numeric(10, 2) not null,
  payment_time timestamptz,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  body text,
  category text not null default 'briefing',
  visibility text not null default 'free' check (visibility in ('free', 'member')),
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists content_published_idx on public.content (published_at desc);

create table if not exists public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  kind text not null default 'keyword',
  created_at timestamptz not null default now(),
  unique (user_id, label)
);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_requests enable row level security;
alter table public.content enable row level security;
alter table public.watchlists enable row level security;

drop policy if exists "profiles are readable by owner" on public.profiles;
create policy "profiles are readable by owner" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles are insertable by owner" on public.profiles;
create policy "profiles are insertable by owner" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "profiles are editable by owner" on public.profiles;
create policy "profiles are editable by owner" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "plans are public" on public.plans;
create policy "plans are public" on public.plans for select using (true);

drop policy if exists "subscriptions are readable by owner" on public.subscriptions;
create policy "subscriptions are readable by owner" on public.subscriptions for select using (auth.uid() = user_id);

drop policy if exists "payment requests are readable by owner" on public.payment_requests;
create policy "payment requests are readable by owner" on public.payment_requests for select using (auth.uid() = user_id);
drop policy if exists "payment requests are insertable by owner" on public.payment_requests;
create policy "payment requests are insertable by owner" on public.payment_requests for insert with check (auth.uid() = user_id);

drop policy if exists "free or active content is readable" on public.content;
create policy "free or active content is readable" on public.content for select using (
  visibility = 'free'
  or exists (
    select 1 from public.subscriptions
    where subscriptions.user_id = auth.uid()
      and subscriptions.status = 'active'
      and (subscriptions.ends_at is null or subscriptions.ends_at > now())
  )
);

drop policy if exists "watchlists are readable by owner" on public.watchlists;
create policy "watchlists are readable by owner" on public.watchlists for select using (auth.uid() = user_id);
drop policy if exists "watchlists are insertable by owner" on public.watchlists;
create policy "watchlists are insertable by owner" on public.watchlists for insert with check (auth.uid() = user_id);
drop policy if exists "watchlists are editable by owner" on public.watchlists;
create policy "watchlists are editable by owner" on public.watchlists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "watchlists are removable by owner" on public.watchlists;
create policy "watchlists are removable by owner" on public.watchlists for delete using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
