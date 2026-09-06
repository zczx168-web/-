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

For the daily morning report, publish one row per day with `category = 'briefing'`. Store the structured sections as JSON in `body`; the website renders these six sections automatically:

```json
{
  "conclusion": "国内供应释放有限，焦煤短期高位震荡偏强。",
  "overnight": "财联社和 CCTD：列出隔夜最重要的 3-8 条变化。",
  "supply": "煤矿复产、产量、安监和库存变化。",
  "imports": "甘其毛都通关、蒙煤价格和进口补充。",
  "demand": "焦炭价格、钢厂利润、铁水和焦化利润。",
  "watch": "今天重点跟踪口岸通关、煤矿增量和焦炭提涨执行。"
}
```

Example insert:

```sql
insert into public.content (title, summary, body, category, visibility, published_at)
values (
  '9月6日焦煤晨报：供应释放有限，高位震荡偏强',
  '国内供应修复仍慢，进口补充尚未形成连续增量。',
  '{"conclusion":"国内供应释放有限，焦煤短期高位震荡偏强。","overnight":"财联社：焦煤相关期货和产业链消息摘要。","supply":"煤矿复产以恢复产能为主，实际增量有限。","imports":"口岸通关边际改善，但尚未形成连续补充。","demand":"焦炭提涨改善焦企利润，钢厂承接能力仍需观察。","watch":"重点跟踪口岸通关、煤矿增量和焦炭提涨执行。"}',
  'briefing',
  'member',
  now()
);
```

Other member content categories supported by the website are `data-card`, `event`, `report`, and `qa`. They appear under the member content tabs and are filtered without exposing them to unsigned or inactive accounts.

For a quick end-to-end test, run `supabase/member-content-seed.sql` after the schema. It inserts one substantive sample item for each member category, including metrics, a dated event timeline, report sections, and a question with evidence-based answer. Replace these seed rows with the daily research content before the public launch.

## Free public-source collector

The GitHub Actions workflow at `.github/workflows/collect-daily.yml` runs at several Beijing-time windows and executes `scripts/collect_market_data.py`. It reads public pages from DCE, CCTD, the National Bureau of Statistics, Customs, and NDRC, then writes a deduplicated digest to `data/daily-brief.json`. The website loads this file into the public `焦煤快讯` panel. Run the workflow manually from the GitHub Actions tab to test it; scheduled runs may be delayed by GitHub and a source can be skipped when its public page is unavailable. The collector records such warnings in the JSON instead of fabricating data.
