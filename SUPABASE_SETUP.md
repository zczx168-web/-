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

The publishable key is intended for browser use. Never put a database password or service-role key in this file.

Run `supabase/schema.sql` in the Supabase SQL Editor after the project is created. It creates profiles, plans, subscriptions, payment requests, member content, watchlists, and Row Level Security policies.
