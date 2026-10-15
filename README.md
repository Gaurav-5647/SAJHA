# SAJHA — Backend + Frontend

React frontend + Node.js/Express backend + MongoDB/Mongoose. Customer, Worker and Admin panels, responsive layouts and same-Wi-Fi phone access are included.

## Folder layout

- `backend/`: independent package.json/package-lock.json, src, tests, scripts and .env.example. Setup creates a private local .env file; no gateway keys or local secrets are bundled.
- `frontend/`: independent package.json/package-lock.json, React source, Vite config and prebuilt dist.
- `README.md`, `API.md`, `TEST-REPORT.md`, Windows setup/start launchers.

## Quick start (one command each)

```powershell
npm.cmd install    # installs backend + frontend and builds the frontend (frontend/dist)
npm.cmd start      # starts the server (MongoDB must be running)
```

- Customer / Worker: http://localhost:5000
- Admin: http://localhost:5001/admin/login
- Agent: http://localhost:5002

`npm start` rebuilds the frontend automatically if `frontend/dist` is missing. After changing frontend source run `npm.cmd run build`. Create the first admin with `npm.cmd run admin -- admin@example.com "YourStrongPassword123!" "SAJHA Admin"`.

The commands inside `backend/` and `frontend/` still work independently.

## Languages (v1.1 changes)

- All 24 languages in Profile → Website Language now work. Hindi uses the built-in dictionary (offline). Every other language is translated by the backend and cached in MongoDB (`TranslationCache`), so each text is translated only once.
- `TRANSLATION_PROVIDER` in `backend/.env`: `auto` (default: OpenAI if `OPENAI_API_KEY` is set, otherwise free keyless Google/MyMemory), `free`, or `openai`. The server needs internet access for non-Hindi languages. For best quality on rare languages (Bodo, Santali, Kashmiri, Manipuri) add an `OPENAI_API_KEY`.
- Devanagari-script languages (Bodo, Dogri, Konkani, Maithili, Bhojpuri, Awadhi, Sanskrit, Nepali) show the Hindi labels if no translation provider is reachable.
- The SAJHA Assistant (chatbot) now always replies in the customer's profile language (text and voice). Questions typed in any language/script are understood; the voice-language list contains all supported languages.

## Admin reports (CSV)

`GET /api/admin/reports/:resource` now exports every record with all columns (customer / worker / service / address names flattened, timelines, remarks, support conversations, money in INR, dates in IST). Files open correctly in Excel with Hindi text (UTF-8 BOM). Available: workers, customers, bookings, payments, online-payments, ledger, reviews, support, services, locations, skill-requests, audit-logs.

## Requirements

Node.js 22+ and a running MongoDB Server, or your MongoDB Atlas URI. MongoDB Compass alone is not the database server.

## Backend .env

The setup script creates `backend/.env` from `.env.example` and generates a development JWT secret. The ZIP does not include `.env` or Cashfree credentials. For Atlas, update MONGODB_URI locally. For public deployment, use a new private JWT secret, Cashfree keys for the matching environment, and trusted HTTPS.

Default configuration:

```env
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/sajha
NODE_ENV=development
APP_URL=http://localhost:5000
```

Setup generates JWT_SECRET locally. SMTP entries are empty until you configure email delivery.

## First setup (PowerShell opened in SAJHA)

```powershell
cd backend
npm.cmd install

# Create admin once. Replace these example credentials.
npm.cmd run admin -- admin@example.com "YourStrongPassword123!" "SAJHA Admin"

cd ../frontend
npm.cmd install
npm.cmd run build

cd ../backend
npm.cmd start
```

Open **http://localhost:5000**. Admin login: **http://localhost:5001/admin/login**. MongoDB must be running. Keep the backend terminal open.

The prebuilt frontend is also included, so after backend installation you can start immediately without rebuilding it. Rebuild after changing frontend source.

## Separate development terminals

Terminal 1, opened in SAJHA:

```powershell
cd backend
npm.cmd install
npm.cmd run dev
```

Terminal 2, opened in SAJHA:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Open **http://localhost:5173** for frontend hot reload. Vite proxies `/api` to backend port 5000; the browser uses relative API paths, so no frontend API URL variable is needed. For a single-link LAN phone demo, use the compiled app on backend port 5000.

## Regular start after setup

```powershell
cd backend
npm.cmd start
```

For frontend changes, run this from backend first:

```powershell
npm.cmd run build:frontend
npm.cmd start
```

## Windows launchers

- `Setup-Windows.bat`: installs frontend/backend dependencies and builds the frontend.
- `Start-Windows.bat`: starts backend and serves frontend on port 5000.
- Create your admin separately using the command above.

## Same Wi-Fi / hotspot phone access

The backend listens on `0.0.0.0`, prints private LAN links at startup, and serves both frontend and API from one origin. Connect your laptop and phone to the same network, then open the printed **Phone / same Wi-Fi** link in the phone browser. You can also open Profile → Open on Phone and copy the link.

Allow Node.js through Windows Firewall on Private networks. Guest Wi-Fi device isolation may block device-to-device access. Keep the laptop and backend running. This is a local network link, not a public internet link.

## Hindi / English and voice assistant

All roles: Profile / Settings → Website Language. Hindi/English and regional-language choices are available. Preference is saved per account across devices. Menus, forms, service labels and status labels switch language. All four roles can choose a regional UI language. Canonical service/category/status records remain English; staff complaint views preserve original text alongside English translation. Names, addresses and user-written messages remain as entered; language selection does not rewrite personal information.

The customer assistant supports Hindi/English/Hinglish keywords, related terms and approximate spellings for all 18 built-in services. It suggests search/info questions while typing, asks for clarification for ambiguous services, and shows only eligible real workers. Use the voice-language selector for Hindi or English. The mic transcribes and submits your question; spoken replies can be disabled or replayed. Booking still requires confirmation in the booking form.

The assistant's photo button sits to the left of the message box. It can take a photo on a phone or choose an image; the browser compresses it before sending. With `OPENAI_API_KEY` configured, the backend asks the vision model to map the image to an enabled SAJHA service, then searches approved, available workers using the customer's saved location. If the photo is unclear, the assistant asks the customer to choose a service. Images are processed for that request and are not stored by SAJHA. The selected image is sent to the configured OpenAI API for analysis. An OpenAI API key and available API credits are required; the app does not include a key.

Desktop microphone: open localhost in a supported browser and allow microphone permission. Recognition availability depends on the browser speech service and may need internet; typing works without voice recognition.

Phone microphone requires a trusted HTTPS origin. For your own local demo devices:

```powershell
cd backend
npm.cmd run https:cert
npm.cmd run start:https
```

Install and trust `backend/certs/SAJHA-Local-CA.crt` on your own phone using its OS certificate settings. Open the printed HTTPS Wi-Fi link (port 5443); simply bypassing a certificate warning may not enable the microphone. Keep the private `local-key.pem` on the laptop. Regenerate/trust the certificate again if the Wi-Fi IP changes. Local certificates are generated on your machine and are not included in this ZIP. For a public deployment use your domain's trusted HTTPS certificate. Ordinary HTTP LAN links continue to support typing and the rest of the app.

## End-to-end demo

Customer and worker use separate browser profiles or private windows. Admin has a separate portal and cookie, so it can stay signed in alongside a customer/worker in the same browser.

1. Register a customer, then login. Initially there are **zero workers**.
2. Add a complete saved address, for example your real neighbourhood PIN, city, district and state. Set it as default.
3. In another session, register a worker with a matching service and PIN. Login shows the pending review page. There is no normal job dashboard access yet.
4. Worker edits their submitted profile: bio, locality, city, district, state, experience, starting price and optional additional service PIN codes.
5. Admin logs in, opens Worker Approvals, reviews the submitted profile and approves it. Verification badges are separately controlled in Verification.
6. Worker sets availability to **available**. The backend requires a complete bio/address. The customer search and assistant now show the approved worker.
7. Customer opens a category → skill → worker → Book Now. Choose address, future date/time and notes. The backend fixes the estimate to the worker's stored starting price; it ignores client-provided prices.
8. Worker opens Job Requests, accepts the request, then updates On The Way → Reached → In Progress → Completed.
9. Customer follows the timeline in My Bookings and rates the completed job. A completed job can be reviewed only once, by its customer.
10. Completion creates a pending cash-payment transaction. Admin records Paid only after cash is received/reconciled. Earnings count paid transactions; pending payments are shown separately.
11. Customer or worker creates a support ticket. Admin reads it, replies, sets status/priority. Replies and notifications are saved.
12. Suspend the worker from admin. The worker immediately disappears from customer and assistant results; the backend blocks new jobs. React refreshes records every 10 seconds.

## Included features

- Separate customer/worker login selection, separate admin portal, registration validation, password confirmation and visibility, strength indicator, remember-me cookies.
- Bcrypt hashes, signed JWT in HttpOnly cookies, backend role checks, database account-state checks, request limits, server-side input whitelists, authenticated ownership checks, server-revoked logout sessions.
- Optional SMTP password reset with hashed, expiring, single-use reset tokens. Changing passwords invalidates existing sessions. Configure SMTP to enable actual delivery.
- Five category cards, dedicated category pages, dynamic service tabs, animated search/autocomplete, real database worker lists and empty states.
- Worker approvals, rejection/correction/resubmission, suspension/reactivation, additional-skill requests and administrative verification status.
- PIN/service-area matching. Ranking: same PIN first, higher rating next, fewer completed jobs next to support fair allocation.
- Profile/photo editing (PNG/JPG/WebP up to 1 MB), saved address add/edit/delete/default, favorites, recently used services.
- Booking creation, accept/reject, ordered status transitions, customer cancellation before travel/work, timeline, review, rebooking and printable service invoice.
- Worker dashboard, job history, daily/weekly/monthly earnings charts and transaction history.
- Hindi/English/Hinglish keyword assistant for service search, recent bookings, help and simple preferred date/time detection. It queries the same approved-worker eligibility logic as customer search and never invents workers.
- Persistent notifications, help tickets, conversations and administrator replies.
- Admin lists with search, status filters, pagination, global search, full record details, approval controls, service management, cash-payment status recording, review flagging, notification broadcasts, verification, locations, reports, analytics and audit logs.
- Analytics: real customer/worker totals, approvals, booking trends, completion/cancellation rates, registrations, worker availability, service demand/available-worker gap, district activity and worker performance.
- Admin booking correction requires a reason and audit log. Completed bookings cannot be rewritten or force-completed through admin correction, preserving earnings/review integrity.
- CSV exports, printable invoices, responsive layouts, mobile navigation, loading/error/empty states and toast feedback.

## Explicit implementation boundaries

- **Payments:** cash accounting and reconciliation, not an online payment gateway. Marking Paid records a reconciled payment; it does not transfer money. Initial stored starting price 0 means a quote is needed; the operator/worker should set a meaningful estimate before booking.
- **Assistant:** deterministic bilingual service keyword/intent parser, not a generative LLM. It handles the advertised service synonyms and basic tomorrow/time phrases; complex Hindi sentences or scheduling interpretation should be checked in the booking form.
- **Location:** exact PIN and explicit worker service-area PINs. No GPS/distance calculation is fabricated. Address suggestions come from previously saved platform addresses; for a brand-new PIN the user manually supplies city/district/state. No national postal lookup provider is connected.
- **Updates:** polling every 10 seconds instead of Socket.io. Approval/account state is checked on every backend action.
- **Verification:** administrator status/notes workflow; this version does not upload or validate identity certificates. Support tickets accept private photo/video evidence.
- **Exports:** working CSV reports and browser Print/Save PDF for service invoices. Dedicated report PDF templates are not supplied.
- **Correction permissions:** pending/rejected/needs-correction workers may edit the nonprivileged profile fields. This version does not implement a per-field correction allowlist.
- **Admin lists:** filters/pagination return a page to the UI. General full-text search uses bounded application-side filtering; use database indexes/search and aggregation pagination before very large public deployments.
- **Service creation:** original five categories remain fixed. Admin can add sub-services within them. New worker skills are driven by enabled database services.
- **Public launch:** supply operator legal/privacy/contact details, finalize service cancellation/refund policy, configure SMTP, HTTPS, backups and production infrastructure. The included Terms page describes actual app behavior and identifies missing operator information.


## Tests

From backend:

```powershell
npm.cmd test
```

Integration tests use a temporary MongoDB instance and do not change your application database. A MongoDB test binary downloads on first run.

## Troubleshooting

- MongoDB ECONNREFUSED: start MongoDB Server or configure an Atlas connection.
- No workers: verify admin approval, full worker profile, Available status, matching skill and saved address/service PIN.
- Phone link will not open: verify same Wi-Fi, correct adapter link and firewall permission.
- Password reset unavailable: fill backend/.env SMTP settings and restart.
- Missing .env after moving files: run `npm.cmd run configure` inside backend to generate a fresh local file.
- For Linux/macOS, use `npm` in place of `npm.cmd` in the same folder sequence.

## Separate admin website and readable details

One `npm.cmd start` inside backend starts TWO websites:

- Customer / worker: http://localhost:5000
- Admin only: http://localhost:5001 (opens the admin portal)

The public login/register screen has no admin link. Public port 5000 rejects admin pages, admin APIs and admin login. Admin uses its own session cookie. Both portals use the same MongoDB database. `ADMIN_PORT` and `ADMIN_APP_URL` are in backend/.env. A second frontend install is not required; the server supplies the portal configuration separately for each website.

For phone access use your laptop's LAN IP with :5000 for customer/worker and :5001 for admin; allow both private-network ports in Firewall. HTTPS mode starts customer/worker on :5443 and admin on :5444. For separate public domains, reverse-proxy the customer domain to 5000 and the admin domain to 5001, with trusted HTTPS; set APP_URL and ADMIN_APP_URL to those origins. This ZIP does not provision a public domain.

View/View Details now opens readable labelled cards, account/service sections and booking timelines instead of JSON. After acceptance, each booking displays the other person's phone number and a Call link. Pending or cancelled bookings do not expose contact numbers. Phone access is enforced in the backend response and limited to the customer and assigned worker's own bookings; admin retains its authorized records.

## Agent portal

`npm.cmd start` in backend now starts three websites: customer/worker on http://localhost:5000, admin on http://localhost:5001 and agent on http://localhost:5002. HTTPS mode uses 5443, 5444 and 5445 respectively. Agent ports and password-reset origin are configured with AGENT_PORT, AGENT_HTTPS_PORT and AGENT_APP_URL in backend/.env. The agent site is separate from public registration and has its own cookie.

1. Admin logs in → Agents → Register Agent. Enter name, email, 10-digit phone and initial password (minimum 8 characters).
2. Privately give the agent that email (login ID) and password. The app stores a password hash, not a readable password.
3. Agent opens port 5002 and logs in with email/phone plus password. No public agent signup is available.
4. Agent can search customers/workers, see name, phone, email, saved addresses/service profile, and open all bookings with both parties' details, address, status and timeline.
5. Booking details include Call and Email links, plus contact/follow-up notes with agent identity and timestamp. These are manually recorded coordination notes; the system does not record calls or automatically send emails.
6. Complaints includes customer and worker support tickets, conversations and a related booking when supplied. Agent replies, sets priority and resolves/closes/reopens complaints. The reply appears in the user's support conversation and triggers a notification. Agent actions are audited.
7. My Profile → Change Password requires the current password. Existing sessions are invalidated; log in again with the new password.
8. Admin can suspend/reactivate agents. Suspension invalidates their sessions and prevents further login. Agents cannot create agents, approve workers, change payment records or use admin management APIs.

Records refresh about every 10 seconds. Customers/workers retain their existing post-acceptance counterpart-number rule. Agents have authorized operational access before acceptance too. Contact record search currently uses application-side filtering; apply indexed database queries before large-scale deployment.

## Complaint evidence, agent notifications and private worker remarks

- Create a complaint in Help & Support and select its related completed booking (or another booking if relevant). After sending, upload existing images/video, use Phone camera, or Open live camera to take a photo or record a video. Desktop live camera needs HTTPS or localhost and camera permission. Live videos are silent, maximum 2 minutes; uploaded videos may include their own audio.
- Maximum 5 evidence files per ticket, 20 MB each: JPEG, PNG, WebP, MP4, WebM or MOV. HEIC and other formats should be converted before upload. Playback of a specific video codec depends on the browser.
- Evidence is stored privately in backend/uploads (or UPLOAD_DIR). Back up this folder with MongoDB. It is served only after authentication and ticket authorization; admin/agents can see all ticket evidence, the complainant can see their own. Test uploads are excluded from this ZIP.
- New customer/worker tickets, replies and evidence notify active agents only. Admin still sees all complaints and evidence under Support, without complaint notification entries. If there are no active agents, tickets remain in the database for staff to review.
- Worker Reject or Cancel Job requires a non-empty remark. Speak to type fills the remark field; review it before confirming. Browser voice coverage varies by language. Typed input is always available. Remarks are stored separately and shown only in admin/agent booking records, never in the customer's or worker's booking response.

## Regional languages and automatic translation — configuration required

The language selector includes India's 22 scheduled languages plus English, Bhojpuri and Awadhi. This is a defined language catalog, not every Indian dialect. All four portals and complaint/help composers share it. Regional fonts are bundled. Browser speech recognition does not necessarily support every listed language.

English and the existing Hindi interface dictionary work without a translation API. Additional UI labels and automatic complaint/reply translations require an OpenAI API account/key with available API billing/credits. A ChatGPT subscription is not an API key. Configure **backend/.env**:

```env
OPENAI_API_KEY=your_private_api_key
IMAGE_SERVICE_MODEL=gpt-4o-mini
TRANSLATION_MODEL=gpt-4.1-mini
```

Restart the backend and reload the browser after adding the key. The key stays on the backend. The backend sends UI strings and complaint/help text to the configured model through OpenAI's API; support evidence photos/videos are not sent to the translation model. A photo deliberately attached to the SAJHA Assistant is sent to the configured vision model for service matching. Successful translations are cached in MongoDB.

- Admin and agent complaint conversations show the original message and an English translation.
- Customer/worker conversations show replies translated into their selected profile language. If the profile remains English, the complaint's initial selected message language is used. Original messages remain expandable.
- Staff may compose a reply in any selected language; the receiver's language determines the translated display.
- User names, IDs, email addresses, phone numbers and stored data are retained as entered. Some dynamic record labels/system-generated text may retain their original form.
- When the key is absent, the service fails, or a translation cannot be produced, the app retains the original text and explicitly shows translation unavailable. It does not fabricate a translation. No paid API key is included in this ZIP. Translation quality, especially low-resource languages and mixed-language text, should be reviewed by staff; accuracy across every language has not been certified.

Sources: https://developers.openai.com/api/docs/models/gpt-4.1-mini and https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create

## Translation troubleshooting (fixed update)

Hindi interface labels, including admin/agent and evidence/remark screens, are bundled locally and do not need an API key. Other automatic regional labels and translation of arbitrary complaint/reply text require a valid OPENAI_API_KEY with API credits in backend/.env. Restart the backend after changing .env; never put the key in frontend files.

In the profile language settings, use **Check translation connection**. It reports missing/invalid key, quota/rate limit or connection failure. After fixing the cause, use **Retry translation**; a failed request no longer stays permanently blocked for the browser session. Complaint conversations have a separate retry button. English profiles now receive English replies even when the first complaint was written in another language. Original messages remain intact.

## Latest complaint workflow

- Message/voice language dropdowns removed everywhere. Write any language; original text stays intact. Staff conversation views request English translation automatically, including complaints created by agents. Voice follows the saved profile language; stop the microphone before submitting. Browser speech support and permissions are required.
- Agent complaints tab now includes a form to complain to the admin workspace. Admin support contains all complaints and permits creating and closing a complaint.
- Live evidence is available for 15 minutes **after complaint creation**. Up to 5 photos and 2 videos, each video at most 2 minutes; the existing 20 MB/file cap still applies. Gallery/file upload is removed. Use HTTPS for phone camera/microphone. Server verifies video duration with the bundled ffprobe-static dependency and enforces counts/window/capture-token reuse. Video is silent.
- Closing a complaint locks replies and media upload on both client and server. Customer/worker cannot reopen it. Originals, English translations and evidence remain visible to admin/agent.
- Profile language persists across devices. Switching language resets failed translation attempts, and stale profile refreshes cannot override a newer selection. Hindi interface labels are included offline; arbitrary text and other regional interface translations still require a valid OPENAI_API_KEY with credits and internet access. Use the profile connection check for the actual configuration error; no key is supplied in this ZIP.

## UI theme: Pearl Glass (Light 3D)

The interface is now fully responsive (phone, tablet, desktop) and a light, premium glass theme with a live 3D scene (floating glass cubes, pearl spheres, rings) — no dark surfaces, no green. Palette: pearl white, iris indigo, champagne gold, rose/sky mist. Theme lives in `frontend/src/glass.css` (colors are CSS variables at the top of the file). Rebuild with `cd frontend && npm run build`.

## Light / Dark mode (two UIs in one app)

| Mode  | UI                              | Source folder                 |
|-------|---------------------------------|-------------------------------|
| Light | Pearl Light 3D UI (Responsive)  | `frontend/src/themes/light/`  |
| Dark  | Obsidian Glass 3D UI            | `frontend/src/themes/dark/`   |

* **Toggle location** — in the header, immediately **left of "Saved location"** (customer). For worker/admin it sits just before the bell icon, in the Agent Portal before the user name, and on the **login page** it floats at the top-left of the form side.
* **Automatic** — default is *Auto (system)*: the site opens in Light if the device is in light mode and in Dark if the device is in dark mode, and follows the device live when the OS theme changes.
* **Manual default** — open the toggle and choose **Light**, **Dark** or **Auto (system)**. The choice is remembered on that device (`localStorage` key `sajha-theme`) and also applies to the login page. Choosing *Auto* clears the override.
* **No flash** — a tiny script in `frontend/index.html` applies the theme before the page paints.
* **Responsive** — both UIs support phone, tablet and desktop (the responsive layer of the Light UI was ported to Dark).

### How it is built
`npm run build` / `npm run dev` first run `scripts/build-themes.mjs`, which scopes every rule of both UIs under `html[data-theme="light"]` / `html[data-theme="dark"]` and writes `src/themes.generated.css`. Edit the CSS inside `src/themes/light` or `src/themes/dark` — never the generated file. The toggle logic is `src/theme.jsx`, its look is `src/theme-toggle.css`.

After unzipping run **Setup-Windows.bat** (it rebuilds `frontend/dist`), then **Start-Windows.bat**.


## Online payments (Cashfree)

1. Create Cashfree keys (sandbox first) and put them in `backend/.env`: `CASHFREE_ENV`, `CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`.
2. In the Cashfree dashboard set the webhook URL to `https://<your-domain>/api/payments/webhook` (events: payment success/failed, refund status). `APP_URL` must be your public https URL.
3. Flow: customer pays after the worker accepts → agent and worker are notified → worker completes the job → 15 minute complaint window → shares move to the admin payout queue. If the customer complains, an agent decides the refund amount (Agent portal → Payments, or Admin → Online Payments); refunds are initiated through Cashfree, while the admin manually transfers the remaining worker/agent shares and records the UTR/UPI reference in Admin → Online Payments. This ZIP does not initiate bank/UPI payouts to recipients.
4. Split (hidden from customers and workers): agent 3%, admin 7%, and worker 90% (10% visiting charge + 80% work charge). A complaint refund is deducted from the 80% work portion; the visiting charge is retained by the worker. Admin records each manual share after transferring it. The no-complaint path queues payouts after the 15-minute window; the 30-minute SLA still requires staff action before then.
5. Set `REQUIRE_PAYMENT_BEFORE_COMPLETE=false` if workers may complete jobs paid in cash.


## Live location, PIN lookup and manual payment review

- After a worker accepts, the customer and worker each see a **Share location** control on the active booking. They must grant browser location permission. Sharing is stop-able and is cleared when the booking completes or is cancelled. The other booking participant and authorized agent/admin accounts can open the latest point in Maps. Coordinates are not a continuous map feed; the app refreshes the latest point and location sharing requires a trusted HTTPS origin on phones.
- The customer can use **Use current location** to find workers who have shared a recent GPS point, sorted within 25 km. PIN search remains available. Worker GPS discovery uses locations shared during active bookings.
- PIN entry suggestions come from India Post's PIN-code lookup and fill post office/locality, district and state. Worker registration, worker profile and saved customer addresses reject PINs not found by the lookup. Internet access is needed for new PIN lookups.
- Cashfree collects the customer's payment into the merchant account configured with Cashfree. This app does not move money directly into an agent's bank account. The agent handles complaint decisions; the admin performs external transfers and records references for worker, agent and admin ledger entries. Partial refund requests go back through Cashfree. Settle and payout deadlines require staff to be available; missed disputes are escalated in the staff queues.

## Cashfree Payouts to workers and agents

Customer checkout uses the Payment Gateway keys. Transfers to workers and agents use separate Cashfree Payouts credentials. In Cashfree Payouts, activate/configure the Payouts product and add its App ID and Secret Key in backend/.env:

    CASHFREE_PAYOUT_ENV=sandbox
    CASHFREE_PAYOUT_APP_ID=your_payouts_app_id
    CASHFREE_PAYOUT_SECRET_KEY=your_payouts_secret
    CASHFREE_PAYOUT_API_VERSION=2024-01-01

Use matching sandbox keys first. Change the environment to production only after Cashfree has activated Payouts for the account and you have installed the production Payouts keys. Keep these keys in the backend environment, never in frontend files.

After a customer payment is cleared for settlement, Admin → Online Payments shows the worker, agent, and retained SAJHA shares. Select Send via Cashfree, choose the agent (for automatic settlements), enter the verified UPI or bank details, and confirm. A Cashfree transfer normally starts as Processing; select Check Cashfree status until Cashfree confirms the terminal result. Only a successful transfer is shown as Paid. A failed transfer can be retried after reviewing the recipient details. The retained admin share is recorded separately and is not transferred out.

Workers and agents can view the service, booking, amount, transfer reference, and status under My Profile → Payout history. Payout destination details are entered for the transfer and are not saved in SAJHA's database.

Customer service invoices have a print-ready SAJHA layout and can be saved as PDF from Bookings → View Invoice. The document states when it is a service/payment record rather than a GST tax invoice.
