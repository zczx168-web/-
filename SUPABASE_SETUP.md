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

The website sends magic links back to the production GitHub Pages URL:
`https://zczx168-web.github.io/-/`. Add this exact URL to Supabase's redirect allowlist.

The publishable key is intended for browser use. Never put a database password or service-role key in this file.

## Chinese magic-link email

Supabase requires Custom SMTP before editing email templates. In `Authentication > SMTP Settings`, configure a mailbox SMTP account first. For QQ Mail, use `smtp.qq.com` with port `465` (SSL) or `587` (STARTTLS); use the mailbox authorization code as the SMTP password. Do not use or share your normal mailbox password.

After SMTP is saved, go to `Authentication > Email Templates > Magic Link`, set the subject to `焦煤观察登录验证码` and replace the body with:

```html
<h2>登录焦煤观察</h2>
<p>您好，您的邮箱验证码是：</p>
<p style="font-size:28px;letter-spacing:6px;font-weight:700;">{{ .Token }}</p>
<p>请回到焦煤观察页面输入这 6 位验证码完成登录，不要点击邮件中的链接。</p>
<p>如果不是您本人操作，请忽略本邮件。</p>
<p>此链接仅限本人使用，打开后即可完成登录。</p>
```

Save the template, then request a new link from the production website. Existing emails keep their original English content.

Run `supabase/schema.sql` in the Supabase SQL Editor after the project is created. It creates profiles, plans, subscriptions, payment requests, member content, watchlists, and Row Level Security policies.
