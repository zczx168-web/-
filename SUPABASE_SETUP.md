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

In `Authentication > Email Templates > Magic Link`, set the subject to `焦煤观察登录链接` and replace the body with:

```html
<h2>登录焦煤观察</h2>
<p>您好，点击下面按钮登录焦煤观察：</p>
<p><a href="{{ .ConfirmationURL }}" style="display:inline-block;padding:10px 18px;background:#157c6c;color:#fffdf8;text-decoration:none;border-radius:4px;">立即登录</a></p>
<p>如果不是您本人操作，请忽略本邮件。</p>
<p>此链接仅限本人使用，打开后即可完成登录。</p>
```

Save the template, then request a new link from the production website. Existing emails keep their original English content.

Run `supabase/schema.sql` in the Supabase SQL Editor after the project is created. It creates profiles, plans, subscriptions, payment requests, member content, watchlists, and Row Level Security policies.
