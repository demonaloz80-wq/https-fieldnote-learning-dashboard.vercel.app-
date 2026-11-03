# Fieldnote deployment: Vercel + Supabase

The dashboard stays on Vercel. Supabase provides hosted authentication and PostgreSQL; Vercel API functions mediate auth, profile, course, learning-state, and Gemini requests. There is no Render API origin or SQLite database in the deployed path.

```text
/
├── api/                      # Vercel serverless API routes
├── lib/fieldnote-api-proxy.js # Supabase/Gemini server-side handlers
├── supabase/migrations/       # Database schema and row-level policies
├── index3.html               # Original single-page dashboard
├── script.js
└── style.css
```

## 1. Create Supabase project and schema

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. In **SQL Editor**, run [`supabase/migrations/202611020001_fieldnote_schema.sql`](./supabase/migrations/202611020001_fieldnote_schema.sql).
3. In **Authentication → URL Configuration**, set the site URL to `https://fieldnote-learning-dashboard.vercel.app`. Add your Vercel Preview origins if you use previews.
4. Configure Supabase Auth email delivery (SMTP) and the password-recovery email template to show the six-digit `{{ .Token }}` code. Keep email confirmation enabled; the account page tells new users to confirm before signing in.
5. To create the first administrator, register your own account, then run this once in the Supabase SQL Editor using your account email:

   ```sql
   update public.profiles p
   set role = 'admin'
   from auth.users u
   where p.id = u.id
     and lower(u.email) = lower('your-admin-email@example.com');
   ```

   Do not expose the Supabase service-role key to the browser. The service key bypasses RLS and is used only by Vercel functions.

## 2. Configure Vercel

Set the project **Root Directory** to the repository root (the directory containing `vercel.json`), and use the **Other** framework preset. Vercel detects the root `api/` functions and runs them on Node.js automatically; `credentials-api/` is a separate local-development project and must not be selected as the project root. `vercel.json` pins the project to the Other preset so the static dashboard and API functions deploy together.

In the Vercel project, add these environment variables for Production and Preview. Copy the project URL and keys from **Supabase → Project Settings → API**:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-private-legacy-service_role-JWT
GEMINI_API_KEY=your-google-ai-studio-key
GEMINI_MODEL=gemini-2.5-flash
```

Redeploy Vercel after setting them. The root opens `index3.html`, which contains the complete single-page dashboard with its original in-page navigation and styling.

## 3. Verify

- `https://fieldnote-learning-dashboard.vercel.app/api/health` should return `{"status":"ok","provider":"supabase"}`.
- Register an account and confirm it using the Supabase email.
- Sign in; the server stores Supabase access/refresh tokens in a same-site HttpOnly cookie.
- Check that student progress synchronizes to their own `student_learning_state` row.
- Ask the Learning Coach a question. `GEMINI_API_KEY` is used server-side and is never sent to the browser.

The SQL migration enables RLS and restricts profiles, dashboard state, consents, courses, lessons, and student progress. Public instructor and published-course reads go through the Vercel server function, which removes private profile fields before returning instructor data. The coach rate limiter stores only an HMAC of the client IP, not the raw address.

### Current boundaries

- Learning dashboard state is cloud-synced for signed-in students; its profile remains in the protected `profiles` table.
- Course publishing and catalog reads are stored in Supabase.
- The legacy `credentials-api/` folder is retained for local development and its existing badge/adaptive tests. Badge issuance, credential revocation, and adaptive-learning endpoints are not yet exposed by the Supabase Vercel functions.
- Vercel function rate limits should be monitored; the Learning Coach has a Supabase-backed limit of 100 requests per 15 minutes per client IP.
