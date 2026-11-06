# Fieldnote deployment: Vercel + Supabase

The dashboard stays on Vercel. Supabase provides hosted authentication and PostgreSQL; Vercel API functions mediate auth, profile, course, learning-state, and GitHub Copilot requests. There is no Render API origin or SQLite database in the deployed path.

```text
/
├── api/                      # Vercel serverless API routes
├── lib/fieldnote-api-proxy.js # Supabase/GitHub Copilot server-side handlers
├── supabase/migrations/       # Database schema and row-level policies
├── index3.html               # Shared dashboard shell
├── views/                    # Separate HTML templates for each dashboard screen
├── script.js
└── style.css
```

## 1. Create Supabase project and schema

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. In **SQL Editor**, run [`supabase/migrations/202611020001_fieldnote_schema.sql`](./supabase/migrations/202611020001_fieldnote_schema.sql).
3. In **SQL Editor**, run [`supabase/migrations/202611060001_remove_requested_instructors.sql`](./supabase/migrations/202611060001_remove_requested_instructors.sql) to remove the two requested instructor accounts and their courses. It matches the requested names at the start of each full name and stops if a name matches multiple instructor accounts.
4. In **Authentication → URL Configuration**, set the site URL to `https://fieldnote-eta-six.vercel.app`. Add `https://fieldnote-eta-six.vercel.app/**` to the redirect URL allow list so email confirmation and password recovery return to the deployed app, and add each Preview deployment URL you intend to use (or a suitable Vercel preview wildcard). The app derives email return URLs from the active deployment instead of sending learners to localhost.
5. In **Authentication → Providers → GitHub**, enable GitHub and add the client ID and secret from a GitHub OAuth app. Set the GitHub OAuth app's authorization callback URL to Supabase's callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`). Set its homepage URL to `https://fieldnote-eta-six.vercel.app`. The app uses a server-side PKCE callback and stores the resulting session in an HttpOnly cookie.
6. Configure Supabase Auth email delivery (SMTP) and the **Reset Password** email template. The recovery form expects a six-digit code, not a clickable recovery link. Use `{{ .Token }}` in the template and do not use `{{ .ConfirmationURL }}` or a localhost URL. For example:

   ```html
   <h2>Reset your Fieldnote password</h2>
   <p>Enter this six-digit code in Fieldnote to reset your password:</p>
   <p style="font-size: 24px; font-weight: bold; letter-spacing: 6px">{{ .Token }}</p>
   <p>Open https://fieldnote-eta-six.vercel.app, choose Student profile, then Forgot password?</p>
   ```

   The code is sent to the email address entered in the recovery form (for example, a Gmail inbox). After setting the template, request a new code; previously sent links or codes may be expired. The recovery flow verifies the code before it allows the user to set a new password. Keep email confirmation enabled; new users are returned to the deployed sign-in page after confirming their email.
7. To create the first administrator, register your own account, then run this once in the Supabase SQL Editor using your account email:

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

In **Vercel → Project → Settings → Environment Variables**, add these variables to **Production**, **Preview**, and **Development**. Selecting the general **Preview** environment applies the variables to all Preview deployments, including branch deployments; add branch-specific overrides only when a branch needs different values. Copy the Supabase URL and keys from **Supabase → Project Settings → API**. The coach uses the GitHub Copilot SDK's bundled runtime in the server-side Vercel function; it does not connect to a separate public runtime service.

```text
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-private-legacy-service_role-JWT
COPILOT_GITHUB_TOKEN=your-copilot-enabled-github-token
COPILOT_MODEL=auto
```

The SDK uses this token only on the server and disables automatic use of any stored CLI login. GitHub documents supported [Copilot SDK authentication methods and token types](https://github.com/github/copilot-sdk/blob/main/docs/auth/authenticate.md); the token must be authorized for Copilot requests. Classic `ghp_` personal access tokens are not supported. For organization-attributed server-to-server usage, follow GitHub's [Copilot SDK server-to-server authentication guide](https://github.com/github/copilot-sdk/blob/main/docs/auth/server-to-server-tokens.md). Installation tokens expire after one hour, so a static installation token must be refreshed before it expires. `COPILOT_MODEL` is optional and defaults to `auto`; the chosen model must be enabled for the Copilot account or organization.

`FIELDNOTE_APP_URL` is optional; leave it unset on Vercel so OAuth and email links use Vercel's deployment URL, or set it to the exact HTTPS origin when deploying outside Vercel. A localhost override is ignored when a Vercel deployment URL is available. Keep both `SUPABASE_SERVICE_ROLE_KEY` and `COPILOT_GITHUB_TOKEN` private; neither may be added to client-side code or a `NEXT_PUBLIC_`/browser-exposed variable. Save the variables, then redeploy Production and Preview deployments so they receive the updated values. For local Vercel development, pull the Development variables with `vercel env pull`.

`GET /api/health` reports whether the Copilot token is configured and which model is selected, without revealing the token.

The root opens the built `index.html`, which contains the complete single-page dashboard with its original in-page navigation and styling.

## 3. Verify

- `https://fieldnote-eta-six.vercel.app/api/health` should return `{"status":"ok","provider":"supabase","coach":{"configured":true,"provider":"github-copilot","model":"auto"}}` after Vercel's Copilot token is configured.
- Register an account and confirm it using the Supabase email.
- Sign in; the server stores Supabase access/refresh tokens in a same-site HttpOnly cookie.
- Use **Continue with GitHub** after configuring the GitHub OAuth app, enabling the provider in Supabase, and adding the app URL to the Supabase redirect allow list.
- Use **Forgot password?** to request a six-digit email code, verify it, and then set a new password.
- Check that student progress synchronizes to their own `student_learning_state` row.
- Ask the Learning Coach a question. `COPILOT_GITHUB_TOKEN` is used server-side and is never sent to the browser.

The SQL migration enables RLS and restricts profiles, dashboard state, consents, courses, lessons, and student progress. Built-in lessons have four objective-aligned assessment questions. Instructor Studio requires each new lesson to include a measurable objective, 3–8 key ideas, an applied practice task, at least 3 authored assessment questions, and an optional validated YouTube URL. These fields are stored with the published course and lesson records. Supabase-managed database storage is encrypted at rest and API traffic uses HTTPS; RLS and authenticated server routes control who can read or change application data. Encryption at rest does not prevent access by someone holding a privileged service key, so keep that key only in Vercel's encrypted environment-variable store and rotate it immediately if exposed. Public instructor and published-course reads go through the Vercel server function, which removes private profile fields before returning instructor data. The coach rate limiter stores only an HMAC of the client IP, not the raw address.

### Current boundaries

- Learning dashboard state is cloud-synced for signed-in students; its profile remains in the protected `profiles` table.
- Course publishing and catalog reads are stored in Supabase.
- The legacy `credentials-api/` folder is retained for local development and its existing badge/adaptive tests. Badge issuance, credential revocation, and adaptive-learning endpoints are not yet exposed by the Supabase Vercel functions.
- Vercel function rate limits should be monitored; the Learning Coach has a Supabase-backed limit of 100 requests per 15 minutes per client IP.
