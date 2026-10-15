# SAJHA API reference

Base path `/api`. JSON requests/responses except CSV exports. Signed HttpOnly cookie authentication. All `/api/admin/*` endpoints require an active admin. Worker job endpoints require approval. IDs are MongoDB ObjectIds. Fields not explicitly permitted are ignored; role/approval/account status cannot be changed through public profile endpoints.

| Method | Path | Role / purpose |
|---|---|---|
| GET | /health | Public health check |
| GET | /services | Public five-category catalog and enabled database services |
| POST | /auth/register | Public customer/worker registration; no admin registration |
| POST | /auth/login | identifier, password, role, remember |
| POST | /auth/forgot | SMTP password-reset email request |
| POST | /auth/reset | token, password; reset within 30 minutes |
| POST | /auth/logout | Revoke existing user sessions and clear cookie |
| GET | /network | Authenticated private LAN links for phone access |
| GET / PATCH | /me | Current account/profile; no role changes |
| PATCH | /workers/profile | Worker nonprivileged profile; optional resubmit |
| PATCH | /workers/availability | Approved worker; available, busy, offline |
| POST | /workers/skills | Approved worker; submit additional skill request |
| GET | /workers/nearby | Customer; skill, pin or address query |
| GET | /workers/:id | Eligible worker detail and completed-job reviews |
| PATCH | /customers/favorites/:id | Customer; toggle favorite worker profile |
| GET / POST | /addresses | Customer; list/add own saved addresses |
| PATCH / DELETE | /addresses/:id | Customer; edit/delete own address |
| GET | /locations/:pin | Suggestions from existing database addresses |
| GET / POST | /bookings | Own bookings / customer booking creation |
| PATCH | /bookings/:id/status | Assigned worker or owning customer; ordered status transition |
| GET / POST | /reviews | Own reviews / completed booking review |
| GET | /transactions | Approved worker's earnings records |
| GET | /notifications | Own notifications |
| PATCH | /notifications/read | Mark own notifications read |
| GET / POST | /support | Own support tickets / create ticket |
| POST | /support/:id/messages | Ticket owner or admin conversation reply |
| POST | /chatbot/search-workers | Customer; message-based real worker/booking lookup |
| GET | /admin/dashboard | Real platform counters and booking trends |
| GET | /admin/analytics | Date-filtered registrations, availability, demand gap, performance, district activity |
| GET | /admin/search | q; global record search |
| GET | /admin/list/:resource | q, status, page, limit; searchable paginated records |
| PATCH | /admin/workers/:id | action: approve, reject, correction, suspend, reactivate, verify |
| PATCH | /admin/customers/:id | status: active/suspended; reason for suspension |
| POST | /admin/services | Add sub-service under one of five categories |
| PATCH | /admin/services/:id | Description/icon/order/enabled updates; no destructive delete |
| PATCH | /admin/bookings/:id/status | Reason-required audited correction; completion cannot be forced |
| PATCH | /admin/payments/:id | Reconciled cash status; reason required |
| PATCH | /admin/reviews/:id | Toggle moderation flag; review text remains unchanged |
| PATCH | /admin/skill-requests/:id | Approve/reject skill request |
| POST | /admin/notifications | target: customer/worker, or individual user ID; text/type |
| GET | /admin/reports/:resource | CSV export with spreadsheet formula-injection escaping |

Supported list resources: workers, customers, bookings, payments, reviews, support, services, verification, locations, audit-logs, skill-requests. The frontend uses a shared list API rather than duplicating separate list routes for each admin screen.

## Key payloads

Registration:

```json
{"role":"worker","name":"Your name","email":"you@example.com","phone":"your 10 digit phone","password":"Your strong password","category":"Home & Repair","skill":"Electrician","experience":3,"pin":"your 6 digit PIN"}
```

Worker profile fields: bio, pin, city, district, state, locality, experience, price, serviceArea (comma-separated PIN codes), resubmit. Approval, verification and role fields are admin-only.

Booking:

```json
{"worker":"WorkerProfile ObjectId","service":"Service ObjectId","address":"Your Address ObjectId","date":"YYYY-MM-DD","time":"HH:mm","notes":"Scope of work"}
```

Server-side booking checks: active customer; approved active available registered worker; complete profile; enabled matching skill; location/service-area match; address ownership; valid future date/time. Amount is read from the database worker profile.

Status: Pending → Accepted → On The Way → Reached → In Progress → Completed. Worker may reject a Pending request with Cancelled. Customer may cancel Pending/Accepted bookings only. Repeated completion is rejected. Each successful transition is saved in the timeline and generates a notification.

## Collection relationships

User → WorkerProfile / CustomerProfile. Booking references User customer, WorkerProfile worker, Service and Address; it also snapshots the service address so deleting/editing an address does not rewrite history. Review references Booking, customer and worker. Transaction references Booking, customer and worker. WorkerAvailability references WorkerProfile. SupportMessage owns an ordered message array with sender references. Notifications are user-scoped. AuditLog records administrator, action, target ID/type, timestamp and reason.

## Account language and assistant

`PATCH /api/me` accepts `language: "hi" | "en"` for customers/workers; admins cannot change language. `GET /api/me` returns the persisted choice.

`GET /api/chatbot/suggestions?q=bijli&lang=hi` (customer): returns suggested question objects `{label,kind,skill?}`. Only enabled catalog services are suggested.

`POST /api/chatbot/search-workers` accepts `{message, language?, kind?, skill?, image?}`. `kind` is search/info/bookings/help. `skill` must match an enabled canonical service. Optional `image` is a compressed PNG/JPEG/WebP data URL (maximum 1 MB image bytes). When `OPENAI_API_KEY` is configured, the backend classifies the image to an enabled catalog service, then uses the normal approved/available worker and saved-location matching. Unclear photos return service choices. Images are not stored by SAJHA. Response contains message, optional real workers/bookings/action, suggestions, ambiguity matches/clarification, and simple preferredDate/preferredTime hints. Ambiguous service queries require user selection. These endpoints do not create bookings. Microphone recognition and reply synthesis run in the browser, not on the server.

## Separate portals / booking contacts

Public server 5000 and admin server 5001 share the database, but use `sajha` and `sajha_admin` cookies respectively. Public server refuses admin API/page access and admin logins. Admin server refuses registration and customer/worker login. `GET /api/bookings` includes `contact: {name, phone}` only for Accepted / On The Way / Reached / In Progress / Completed bookings belonging to the requester; Pending/Cancelled returns contact:null. Nested participant objects omit phone fields. No public worker listing exposes phone numbers.

## Agent operations

- Admin only: GET /api/admin/agents, POST /api/admin/agents {name,email,phone,password}, PATCH /api/admin/agents/:id {status:active|suspended}.
- Agent only and active: GET /api/agent/dashboard; GET /api/agent/records/:resource (customers/workers/bookings/complaints) with q/status/page; GET/POST /api/agent/bookings/:id/notes (POST text, party customer|worker|both, method call|email|follow-up).
- Existing POST /api/support/:id/messages now permits active agents to reply and update status/priority. Customer/worker ownership checks remain enforced.
- Agent password changes use PATCH /api/me with currentPassword and newPassword; session version increments.
- Agent server uses sajha_agent cookie and accepts only agent logins. Public agent registration remains forbidden. Safe contact projections omit password/reset/session fields.

## Regional complaints and evidence

GET /api/languages returns the 25-choice catalog and translationConfigured flag. PATCH /api/me accepts catalog language codes for all four roles. POST /api/translate accepts texts (max 60, 2500 characters each, 25000 total), target and optional source=en for UI strings. Key remains server-side.

GET /api/support/:id/conversation authorizes the ticket owner/admin/agent and returns original messages, translation status/text, target and evidence metadata. Staff target is English. Customer/worker target is their non-English profile preference, otherwise the initial complaint message language. Translation failures return original text with status=unavailable.

POST /api/support/:id/attachments accepts one multipart file field `file`, up to 20 MB. Owner only. Five files per complaint. GET /api/support/:id/media/:file uses attachment ID and ticket authorization; images/video have validated supported signatures. Media files must be backed up separately with the database.

POST /api/support and /messages accept optional language. Complaint events notify active agents, not admins; admin listing still contains tickets. Agent notifications have relatedTicket for navigation.

Worker PATCH /api/bookings/:id/status to Cancelled requires remark (nonempty, max 2000) and optional language. Rejection/cancellation is allowed before Completed/Cancelled. WorkerRemark records are separate, included only in admin/agent booking records. Public booking responses omit remarks.

Latest evidence API: POST /api/support/:id/capture with {kind:"image"|"video"} obtains a short-lived one-use token for this owner/ticket. POST /api/support/:id/attachments must include X-Capture-Token. Both routes reject closed/expired tickets. Limits: 5 photos, 2 videos, 120 seconds/video, 20 MB/file; deadline is 15 minutes after ticket creation. Closed support replies return 409 even when the client submits status Open. Original message language is auto detected by the translation provider; no form language dropdown is required.

## Online payments (Cashfree escrow)

| Method | Path | Role / purpose |
|---|---|---|
| POST | /payments/create-order | Customer; `{booking}` → Cashfree `paymentSessionId` (booking must be Accepted or later) |
| POST | /payments/verify | Customer; `{orderId}` confirm after returning from Cashfree |
| POST | /payments/webhook | Cashfree only; HMAC-SHA256 signature on the raw body (`x-webhook-signature`, `x-webhook-timestamp`) |
| GET | /payments/mine | Customer/worker; sanitized state. Never contains percentages or the split |
| GET | /agent/payments | Agent; full breakdown, `?status=` |
| POST | /agent/payments/:id/decide | Agent/admin; `{refundAmount, note}` for a Disputed payment |
| GET | /admin/payment-ledger | Admin; escrow total, ledger totals per party, recent payments |

Rules (percent of booking amount): agent 3, admin 7, visiting charge 10 (always to worker), remaining 80 is the work portion. Refund to customer = 0..80 (agent decides). Worker payout = visiting + work portion − refund.
Timeline: complaint window 15 min after the worker marks Completed; settlement by 30 min. No complaint → auto settle (worker 90 / agent 3 / admin 7). Complaint → payment is held until an agent decides; overdue decisions notify agents and admins. Bookings cancelled after payment are refunded in full.

## Cashfree Payouts and payout history

| Method | Route | Access and purpose |
|---|---|---|
| GET | /payments/payout-history | Worker/agent; only ledger entries assigned to the signed-in account |
| GET | /admin/payout-recipients | Admin; active agents available for payout selection |
| POST | /admin/payments/:paymentId/payouts | Admin; starts a Cashfree Payout V2 transfer for a worker/agent or records the retained admin share |
| POST | /admin/payouts/:ledgerId/check | Admin; checks Cashfree transfer status and updates the payout ledger |

Cashfree Payouts credentials are separate from Cashfree Payment Gateway credentials. Transfer entries remain Processing until Cashfree returns a successful terminal status. UPI and bank account values are submitted to Cashfree for the transfer and are not stored in the SAJHA payout ledger.
The admin button calls the Cashfree Payouts API from the backend; it does not redirect the admin to a Cashfree checkout page. The app shows **Paid** only after Cashfree reports a successful terminal bank-transfer status. A Cashfree Payouts account, separate Payouts API keys, an eligible/funded payout source, and correct beneficiary details are required.
