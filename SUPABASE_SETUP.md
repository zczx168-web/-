# Supabase Email Login

1. Create a Supabase project.
2. In Authentication > Providers, enable Email.
3. In Authentication > URL Configuration, add these redirect URLs:

   - `https://zczx168-web.github.io/-/`
   - `http://127.0.0.1:4173/`

4. Copy the project URL and publishable key into `supabase-config.js`:

   ```js
   window.SUPABASE_CONFIG = {
     url: 'https://your-project.supabase.co',
     publishableKey: 'your-public-key',
   };
   ```

The website uses email OTP verification and keeps the production GitHub Pages URL as the auth redirect:
`https://zczx168-web.github.io/-/`. Add this exact URL to Supabase's redirect allowlist.

The publishable key is intended for browser use. Never put a database password or service-role key in this file.

## Chinese email OTP

Supabase requires Custom SMTP before editing email templates. In `Authentication > SMTP Settings`, configure a mailbox SMTP account first. For QQ Mail, use `smtp.qq.com` with port `465` (SSL) or `587` (STARTTLS); use the mailbox authorization code as the SMTP password. Do not use or share your normal mailbox password.

After SMTP is saved, open `Authentication > Notifications > Emails > Templates` and update both `Magic link or OTP` and `Confirm sign up`. Set the subject to `焦煤观察登录验证码` and replace each body with:

```html
<h2>登录焦煤观察</h2>
<p>您好，您的邮箱验证码是：</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:700;">{{ .Token }}</p>
<p>请回到焦煤观察页面输入邮件中的 8 位验证码完成登录，不要点击邮件中的链接。</p>
<p>如果不是您本人操作，请忽略本邮件。</p>
```

Save the template, then request a new verification code from the production website. Existing emails keep their original English content.

The current project sends eight-digit codes. Keep `Authentication > Sign In / Providers > Email > Email OTP length` set to `8` so it matches the website. The `{{ .Token }}` value comes from this setting; changing the email template text alone does not change the code length. Request a fresh code after saving because previously issued codes keep their original length.

Run `supabase/schema.sql` in the Supabase SQL Editor after the project is created. It creates profiles, plans, subscriptions, payment requests, member content, watchlists, and Row Level Security policies.

## Manual payment approval (beta)

The website writes a row to `payment_requests` after a signed-in user scans a QR code and clicks the confirmation button. Review pending requests in the Supabase Table Editor, then run the following SQL in the SQL Editor with the request's `id`, `user_id`, and `plan_code`:

```sql
update public.payment_requests
set status = 'approved'
where id = '<payment_request_id>'
  and status = 'pending';

insert into public.subscriptions (user_id, plan_code, status, starts_at, ends_at)
select user_id, plan_code, 'active', now(), now() + make_interval(days => plans.duration_days)
from public.payment_requests
join public.plans using (plan_code)
where payment_requests.id = '<payment_request_id>'
  and payment_requests.status = 'approved';
```

After approval, the user refreshes the website. Active subscriptions can read `content` rows with `visibility = 'member'`; expired or unapproved accounts cannot. Add member articles from the `content` table, for example with `category = 'briefing'` and `visibility = 'member'`.
