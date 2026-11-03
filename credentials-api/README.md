# Fieldnote Credential Issuer

An isolated Node.js API foundation for issuing and verifying Open Badges 3.0 achievement credentials secured as W3C VC-JWTs. The private Ed25519 key is read only from the ignored `.env` file; it is never sent to clients.

## Run locally

Requires Node.js 22.13 or newer.

```powershell
cd credentials-api
npm install
npm run keys
npm test
npm start
```

The service listens on `https://localhost:3000` when configured with a trusted local certificate and serves the original single-page dashboard (`index3.html`) at its root. Navigation switches dashboard sections in place. Open the dashboard through this same-origin service for authentication, or open an individual HTML page directly as a file; file mode connects to `https://localhost:3000` and requires the service and trusted certificate to be available. The service enables credentialed CORS only for the browser's opaque `null` origin used by local files. For HTTPS, create and trust a `localhost` development certificate, export its PFX to `credentials-api/data/fieldnote-localhost.pfx`, and set `TLS_PFX_PATH` and `TLS_PFX_PASSPHRASE` in the private `.env`. Key generation refuses to overwrite an existing `.env`. Back it up securely; do not commit it.

On Windows, stop the running `Start Fieldnote dashboard` task in VS Code, then run `.\start-api-background.ps1` from the workspace root. It starts the API as a hidden process that continues after VS Code closes. Open `https://localhost:3000` to use the dashboard. To start the API automatically at your Windows sign-in, run `.\start-api-background.ps1 -InstallAtLogon` instead; this registers a task for your current Windows user. The computer must remain powered on, and the localhost certificate must be trusted by your browser. Logs are written to the ignored `credentials-api/data` folder.

After the service starts, create the first administrator from a trusted local terminal using the `ADMIN_API_TOKEN` in `.env`:

```powershell
$adminToken = (Get-Content .env | Where-Object { $_.StartsWith("ADMIN_API_TOKEN=") } | Select-Object -First 1).Substring("ADMIN_API_TOKEN=".Length)
$body = @{ name = "Fieldnote Admin"; email = "admin@example.com"; password = "replace-with-a-unique-password" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/admin/users -Headers @{ Authorization = "Bearer $adminToken" } -ContentType "application/json" -Body $body
Remove-Variable adminToken, body
```

Do not put the admin token in frontend code or browser storage. Use a unique password of at least 12 characters.

## API

- `GET /health` reports service readiness.
- `POST /api/auth/register` creates a student or instructor account and starts a session.
- `POST /api/auth/login` starts a session; `POST /api/auth/logout` revokes it.
- `POST /api/auth/password-reset/request` emails a six-digit code to a matching account; `POST /api/auth/password-reset/confirm` changes the password and revokes existing sessions. Codes expire after 15 minutes and allow five attempts.
- `GET /api/auth/me` returns the signed-in account; `PUT` and `DELETE /api/auth/profile` update or delete that account.
- `GET /api/student/overview` and `GET /api/instructor/overview` enforce their respective roles.
- `GET` and `POST /api/admin/users` require the admin bearer token.
- `GET /issuers/fieldnote` publishes the issuer's public verification key and assertion method.
- `POST /api/credentials` issues an Open Badges 3.0 achievement. Requires `Authorization: Bearer <ADMIN_API_TOKEN>`.
- `GET /api/credentials/:id/qr.svg` returns an SVG QR code linking to public verification.
- `GET /api/verify/:id` verifies the stored VC-JWT signature and current revocation state.
- `POST /api/credentials/:id/revoke` revokes a credential. Requires the admin bearer token.
- `GET /api/adaptive/:courseId/graph` returns a course concept graph.
- `PUT /api/adaptive/:courseId/graph` validates and atomically replaces a graph. Requires the admin bearer token.
- `POST /api/adaptive/:courseId/learners/:learnerId/assessments` records mastery and schedules review. Requires the admin bearer token.
- `GET /api/adaptive/:courseId/learners/:learnerId/path` returns recommended/locked concepts, a skill matrix, and due reviews. Requires the admin bearer token.
- `POST /api/adaptive/:courseId/learners/:learnerId/reviews/:conceptId` records an SM-2 review quality from 0 to 5. Requires the admin bearer token.

Example graph:

```json
{
  "nodes": [
    { "id": "tables", "title": "Database Tables", "area": "Data Modeling", "prerequisites": [] },
    { "id": "joins", "title": "Relational Joins", "area": "Query Design", "prerequisites": ["tables"] },
    { "id": "advanced-queries", "title": "Advanced Queries", "area": "Query Design", "prerequisites": ["joins"] }
  ]
}
```

Assessment bodies include `conceptId`, a server-evaluated `correct` boolean, and a normalized `score` from 0 to 1. Assessments are blocked with HTTP 409 until each prerequisite reaches its configured mastery threshold. Failed assessments route the learner back to direct prerequisite concepts. Mastery uses a weighted update (65% previous mastery, 35% latest score); the response includes area-level average mastery for radar/matrix displays. SM-2 schedules use quality 0-5, with failed recall resetting the interval to one day.

Example issuance body:

```json
{
  "subjectName": "Alex Morgan",
  "achievementName": "Web Development Foundations",
  "description": "Completed the core web development course.",
  "criteria": "Completed all course lessons and passed the final assessment."
}
```

Issuance returns the compact signed VC-JWT, its credential ID, a public verification URL, and a QR image URL. The credential uses the VC v2 and Open Badges 3.0 contexts, with `VerifiableCredential` and `OpenBadgeCredential` types.

## Security boundary

This is a local prototype, not a production deployment. Passwords use scrypt hashes; sessions use random opaque tokens stored as hashes and HttpOnly, SameSite=Strict cookies. Configure `GMAIL_ADDRESS` and a Gmail app password in the private `.env` file to send recovery codes; without both, password-reset requests return a configuration error. Password-reset requests are refused over plain HTTP. For direct HTTPS, set `PUBLIC_BASE_URL` to the HTTPS origin and provide a trusted PKCS#12 certificate with `TLS_PFX_PATH` and, if needed, `TLS_PFX_PASSPHRASE`. If HTTPS terminates at a reverse proxy, set `TRUST_PROXY=true` only when that proxy overwrites `X-Forwarded-Proto`; the app then accepts reset requests only when that header is `https`. Do not send reset codes over public HTTP. Learning progress remains in the user's browser IndexedDB, while account identity/profile data is stored in SQLite. Adaptive learner-state endpoints still require the admin bearer token and must not be called directly from the browser. Before public deployment, add rate limiting, move signing keys to a KMS/HSM, set `PUBLIC_BASE_URL` to the production origin, add encrypted backups and operational monitoring, and review privacy/retention policy. Credential revocation is checked online by this service; no standardized public status-list credential is published yet. The adaptive calculations are a transparent initial heuristic, not a validated learning-science or predictive model.