# Fieldnote deployment: Vercel + Supabase

The dashboard stays on Vercel. Supabase provides hosted authentication and PostgreSQL; Vercel API functions mediate auth, profile, course, learning-state, and Gemini requests. There is no Render API origin or SQLite database in the deployed path.

```text
/
├── api/                      # Vercel serverless API routes
├── lib/fieldnote-api-proxy.js # Supabase/Gemini server-side handlers
├── supabase/migrations/       # Database schema and row-level policies
├── index3.html               # Shared dashboard shell
├── views/                    # Separate HTML templates for each dashboard screen
├── script.js
└── style.css
```

## 1. Create Supabase project and schema

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. In **SQL Editor**, run [`supabase/migrations/202611020001_fieldnote_schema.sql`](./supabase/migrations/202611020001_fieldnote_schema.sql).
3. In **Authentication → URL Configuration**, set the site URL to `https://fieldnote-eta-six.vercel.app`. Add `https://fieldnote-eta-six.vercel.app/**` to the redirect URL allow list so email confirmation and password recovery return to the deployed app, and add each Preview deployment URL you intend to use (or a suitable Vercel preview wildcard). The app derives email return URLs from the active deployment instead of sending learners to localhost.
4. In **Authentication → Providers → Google**, enable Google and add the OAuth client ID and client secret from your Google Cloud OAuth client. In Google Cloud, add Supabase's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI for that client. The app uses a server-side PKCE callback and stores the resulting session in an HttpOnly cookie.
5. Configure Supabase Auth email delivery (SMTP) and the **Reset Password** email template. The recovery form expects a six-digit code, not a clickable recovery link. Use `{{ .Token }}` in the template and do not use `{{ .ConfirmationURL }}` or a localhost URL. For example:

   ```html
   <h2>Reset your Fieldnote password</h2>
   <p>Enter this six-digit code in Fieldnote to reset your password:</p>
   <p style="font-size: 24px; font-weight: bold; letter-spacing: 6px">{{ .Token }}</p>
   <p>Open https://fieldnote-eta-six.vercel.app, choose Student profile, then Forgot password?</p>
   ```

   The code is sent to the email address entered in the recovery form (for example, a Gmail inbox). After setting the template, request a new code; previously sent links or codes may be expired. The recovery flow verifies the code before it allows the user to set a new password. Keep email confirmation enabled; new users are returned to the deployed sign-in page after confirming their email.
6. To create the first administrator, register your own account, then run this once in the Supabase SQL Editor using your account email:

   ```sql
   update public.profiles p
   set role = 'admin'
   from auth.users u
   where p.id = u.id
     and lower(u.email) = lower('your-admin-email@example.com');
   ```

   Do not expose the Supabase service-role key to the browser. The service key bypasses RLS and is used only by Vercel functions.

## 2. Configure Vercel

Set the project **Root Directory** to the repository root (the directory containing `vercel.json`), and use the **Other** framework preset. `vercel.json` runs a dependency-free build script and publishes only `dist/`, which contains the dashboard entry point, its JavaScript, CSS, screen templates, and public assets. The script renames `index3.html` to `index.html`, so the root URL is served directly without a rewrite. Vercel detects the root `api/` functions and runs them on Node.js automatically; `credentials-api/` is a separate local-development project and is intentionally excluded from static output.

In **Vercel → Project → Settings → Environment Variables**, add these variables to **Production**, **Preview**, and **Development**. Selecting the general **Preview** environment applies the variables to all Preview deployments, including branch deployments; add branch-specific overrides only when a branch needs different values. Copy the Supabase URL and keys from **Supabase → Project Settings → API** and create the Gemini key in Google AI Studio:

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-private-legacy-service_role-JWT
GEMINI_API_KEY=your-google-ai-studio-key
```

``GEMINI_MODEL` is optional and defaults to `gemini-2.5-flash`; add it in all three environments only if you want to select a different model. `FIELDNOTE_APP_URL` is optional; leave it unset on Vercel so OAuth and email links use Vercel's deployment URL, or set it to the exact HTTPS origin when deploying outside Vercel. A localhost override is ignored when a Vercel deployment URL is available. Keep `SUPABASE_SERVICE_ROLE_KEY` private: it bypasses row-level security and must never be added to client-side code or a `NEXT_PUBLIC_`/browser-exposed variable. Use the same Supabase project and Gemini key for each environment unless you intentionally maintain separate projects/keys. Save the variables, then redeploy Production and Preview deployments so they receive the updated values. For local Vercel development, pull the Development variables with `vercel env pull`.

The root opens the built `index.html`, which contains the complete single-page dashboard with its original in-page navigation and styling.

## 3. Verify

- `https://fieldnote-eta-six.vercel.app/api/health` should return `{"status":"ok","provider":"supabase"}`.
- Register an account and confirm it using the Supabase email.
- Sign in; the server stores Supabase access/refresh tokens in a same-site HttpOnly cookie.
- Use **Continue with Google** after configuring the Google provider credentials and the Supabase redirect allow list.
- Use **Forgot password?** to request a six-digit email code, verify it, and then set a new password.
- Check that student progress synchronizes to their own `student_learning_state` row.
- Ask the Learning Coach a question. `GEMINI_API_KEY` is used server-side and is never sent to the browser.

The SQL migration enables RLS and restricts profiles, dashboard state, consents, courses, lessons, and student progress. Supabase-managed database storage is encrypted at rest and API traffic uses HTTPS; RLS and authenticated server routes control who can read or change application data. Encryption at rest does not prevent access by someone holding a privileged service key, so keep that key only in Vercel's encrypted environment-variable store and rotate it immediately if exposed. Public instructor and published-course reads go through the Vercel server function, which removes private profile fields before returning instructor data. The coach rate limiter stores only an HMAC of the client IP, not the raw address.

### Current boundaries

- Learning dashboard state is cloud-synced for signed-in students; its profile remains in the protected `profiles` table.
- Course publishing and catalog reads are stored in Supabase.
- The legacy `credentials-api/` folder is retained for local development and its existing badge/adaptive tests. Badge issuance, credential revocation, and adaptive-learning endpoints are not yet exposed by the Supabase Vercel functions.
- Vercel function rate limits should be monitored; the Learning Coach has a Supabase-backed limit of 100 requests per 15 minutes per client IP.
