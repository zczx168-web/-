-- 客服会员开通工具
-- 在 Supabase SQL Editor 中执行一次。执行前请先确保 payment_requests、plans、subscriptions 已存在。

create table if not exists public.staff_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'support' check (role in ('support', 'admin')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.staff_accounts enable row level security;
revoke all on public.staff_accounts from anon, authenticated;

create or replace function public.is_staff_member()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.staff_accounts
    where user_id = auth.uid()
  );
$$;

create or replace function public.admin_list_payment_requests(p_status text default 'pending')
returns table (
  id uuid,
  user_id uuid,
  email text,
  plan_code text,
  plan_name text,
  amount numeric,
  status text,
  note text,
  payment_time timestamptz,
  created_at timestamptz,
  subscription_status text,
  subscription_ends_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_staff_member() then
    raise exception 'not_authorized';
  end if;

  return query
  select
    pr.id,
    pr.user_id,
    au.email::text,
    pr.plan_code,
    p.name,
    pr.amount,
    pr.status,
    pr.note,
    pr.payment_time,
    pr.created_at,
    active_sub.status,
    active_sub.ends_at
  from public.payment_requests pr
  left join auth.users au on au.id = pr.user_id
  left join public.plans p on p.code = pr.plan_code
  left join lateral (
    select s.status, s.ends_at
    from public.subscriptions s
    where s.user_id = pr.user_id
      and s.plan_code = pr.plan_code
      and s.status = 'active'
    order by s.created_at desc
    limit 1
  ) active_sub on true
  where p_status = 'all' or pr.status = p_status
  order by pr.created_at desc;
end;
$$;

create or replace function public.admin_approve_payment_request(p_request_id uuid)
returns table (request_id uuid, user_id uuid, plan_code text, ends_at timestamptz)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  request_row record;
  subscription_end timestamptz;
begin
  if not public.is_staff_member() then
    raise exception 'not_authorized';
  end if;

  select pr.id, pr.user_id, pr.plan_code, p.duration_days, pr.status
  into request_row
  from public.payment_requests pr
  join public.plans p on p.code = pr.plan_code
  where pr.id = p_request_id
  for update;

  if not found then
    raise exception 'request_not_found';
  end if;
  if request_row.status <> 'pending' then
    raise exception 'request_already_processed';
  end if;

  update public.payment_requests
  set status = 'approved'
  where id = p_request_id;

  insert into public.subscriptions (user_id, plan_code, status, starts_at, ends_at)
  select request_row.user_id, request_row.plan_code, 'active', now(), now() + make_interval(days => request_row.duration_days)
  where not exists (
    select 1 from public.subscriptions s
    where s.user_id = request_row.user_id
      and s.plan_code = request_row.plan_code
      and s.status = 'active'
      and (s.ends_at is null or s.ends_at > now())
  );

  select s.ends_at into subscription_end
  from public.subscriptions s
  where s.user_id = request_row.user_id
    and s.plan_code = request_row.plan_code
    and s.status = 'active'
  order by s.created_at desc
  limit 1;

  return query select p_request_id, request_row.user_id, request_row.plan_code, subscription_end;
end;
$$;

create or replace function public.admin_reject_payment_request(p_request_id uuid, p_note text default null)
returns table (request_id uuid, status text)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_staff_member() then
    raise exception 'not_authorized';
  end if;

  update public.payment_requests
  set status = 'rejected', note = coalesce(nullif(p_note, ''), note)
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'request_not_found_or_processed';
  end if;

  return query select p_request_id, 'rejected'::text;
end;
$$;

revoke all on function public.is_staff_member() from public;
revoke all on function public.admin_list_payment_requests(text) from public;
revoke all on function public.admin_approve_payment_request(uuid) from public;
revoke all on function public.admin_reject_payment_request(uuid, text) from public;
grant execute on function public.is_staff_member() to authenticated;
grant execute on function public.admin_list_payment_requests(text) to authenticated;
grant execute on function public.admin_approve_payment_request(uuid) to authenticated;
grant execute on function public.admin_reject_payment_request(uuid, text) to authenticated;

-- 首次配置客服账号：把邮箱替换成已注册的客服邮箱后执行一次。
-- insert into public.staff_accounts (user_id, role, display_name)
-- select id, 'admin', '主客服'
-- from auth.users
-- where email = '你的客服邮箱';
