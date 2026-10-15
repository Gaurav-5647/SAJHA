# SAJHA validation report

Validated on 4 October 2026 with Node.js v24.19.0 and an isolated MongoDB 7.0.24 database.

## Build

`npm run build` — PASS. Vite generated the production frontend. React Router's nonfatal `use client` bundler notices do not prevent output.

## MongoDB integration suite

`npm test` — PASS: 2 test cases, 0 failures. The end-to-end test includes the following checks:

- First customer search starts with zero workers.
- Pending worker login authenticates but cannot open jobs or set availability.
- Pending worker is absent from both normal search and assistant search.
- Approval alone does not make an offline worker visible.
- Complete, approved, available worker becomes visible.
- Incorrect skill and mismatched PIN return no workers.
- Hindi and Hinglish synonyms use real approved worker records.
- Customer cannot access the admin API.
- Customer cannot change another customer's booking.
- Only ordered worker status updates succeed.
- Completed booking creates exactly one transaction.
- Only the booking owner can review a completed booking; duplicates are rejected.
- Rating aggregate updates in the worker profile.
- Support conversation ownership is enforced; admin reply is stored.
- Cash payment status updates the booking and actual revenue metric.
- Suspension hides the worker and blocks job access.
- Admin changes generate audit records.
- Public profile edits cannot escalate a role.
- Admin customer lists do not expose password hashes.
- Logout invalidates a previously issued cookie on the server.

## Browser validation

Playwright/Chromium smoke and end-to-end checks — PASS:

- Customer registration, success modal, login and initial empty state.
- Desktop viewport 1440 px and mobile viewport 390 px; no horizontal document overflow.
- Category navigation and service tabs.
- Saved address form submission.
- Assistant query and genuine no-worker response.
- Separate worker pending screen.
- Admin login, worker approval and worker availability control.
- Approved worker appearing in customer results.
- Customer booking modal and saved booking.
- Worker accepting and completing each status step.
- Customer submitting the completed-job review.
- Admin workers, customers, bookings, services, categories, payments, earnings, reviews, support, notifications, verification, locations, reports, analytics, audit logs and settings screens opened.
- Admin mobile viewport: no horizontal document overflow.
- No uncaught JavaScript page errors during the checked workflows.

Desktop customer, mobile customer, admin and worker screenshots were inspected during validation. Test identities were stored only in temporary databases that were stopped and deleted after checks. No test customers or workers are included in the application database or ZIP.

## Boundaries

This is functional flow/build validation, not a formal security audit, load test or production certification. SMTP delivery requires operator credentials and was not live-tested. Public hosting, cash reconciliation by real users, national postal lookup, certificate uploads and online gateway payments were not tested or connected. See README for implementation boundaries.

## Local network update

- Backend continues listening on 0.0.0.0. Startup now prints all private IPv4 phone links with adapter names.
- Authenticated /api/network endpoint and profile-menu Open on Phone page added for all three roles.
- Deterministic private-address check passed; loopback and public IPv4 addresses are excluded.
- Updated production build passed. Browser end-to-end checks passed with the new network page checked at 1440, 768, 390 and 360 px; no horizontal overflow.
- Physical phone/LAN connectivity depends on shared Wi-Fi, firewall and network isolation; a separate physical phone was not connected in this environment.

## Standalone folder conversion

Backend and frontend now have independent package files and lockfiles. A generated development .env is included inside backend. Server and admin commands load that .env using the source-relative path. Root workspace scripts were removed from the deliverable and run documentation/Windows launchers updated.

## Hindi/English voice and language update

- Production frontend build and all 4 backend tests passed. Coverage includes all 18 built-in service names, Hindi/Hinglish aliases, approximate spelling, ambiguity, suggestions, preference persistence, invalid languages and admin language restrictions.
- Browser workflows passed on the current separated project: customer register/login, Hindi profile preference persistence after reload, Hindi mobile layout at 1440/390/360 px, keyword-based question suggestions, Hindi and English microphone transcript submission, spoken-reply locale selection and microphone permission-error display.
- Recognition events and speech synthesis were simulated in the browser to verify app behavior. Real microphone hardware, remote speech recognition accuracy and installed Hindi voices were not tested.
- Worker Hindi preference and pending profile passed; admin stayed English. Existing admin approval, worker availability, customer booking, worker acceptance/completion, review and all admin pages passed. No uncaught page errors or checked horizontal overflow.
- Local HTTPS certificate generation passed and certificate SAN includes localhost/loopback (available private adapters are added on the user's computer). Actual phone certificate installation and physical LAN microphone access require device/browser testing.
- Names, addresses, free-text biographies/messages are retained as entered. Canonical service/category/status values remain English for admin records.

- Trusted local HTTPS certificate handshake and `/api/health` response passed.

## Separate admin portal, readable records and booking contacts (5 October 2026)

- All backend tests passed, including public-port admin login/page rejection, admin-port registration rejection, admin cookie/login and dashboard authorization.
- Pending bookings omit phone numbers and customer email from participant objects. Accepted and subsequent active/completed states expose only the counterpart phone through a contact object. Another customer's bookings stay inaccessible.
- Production frontend build passed. Browser checks passed for public login without an admin link, separate-port admin login and all admin screens, formatted admin records, formatted worker booking details, acceptance and both counterpart Call links, booking completion and review.
- Existing Hindi/English preference, voice/suggestion simulation, mobile layouts and customer/worker workflows passed without uncaught page errors.
- Screenshots of formatted admin record and booking details were inspected. No public domain was provisioned; ports 5000 and 5001 are the local websites. Actual phone dialing is delegated to the device's telephone handler.

## Agent portal update

- Backend integration tests passed for admin-only agent creation, agent cookie/login, public signup/login restrictions, protected customer/worker/booking records, safe contact fields, contact note persistence, customer and worker complaint replies/resolution, password change/session revocation and admin suspension.
- Agent denied admin dashboard and agent-creation endpoints; customers denied operational agent records.
- Production build passed. Browser workflow passed: admin creates agent, agent logs in, opens booking with both phone numbers, saves coordination note, resolves a customer complaint, changes password and logs in with the new password.
- Agent mobile views checked at 390 and 360 px without horizontal overflow. Existing customer, worker, admin, Hindi/English and booking flow checks passed without uncaught page errors.
- Phone dialing/email launching rely on device handlers. No live telephone call or SMTP delivery was performed.

## Complaint evidence and regional language update

- Four backend tests passed, including required cancellation remarks, staff-only remark exposure, authenticated evidence access and upload validation, agent-only complaint notifications, language persistence, translation fallback and caching.
- Production frontend build passed. Browser checks passed: image upload, live camera photo/video using Chromium simulated media devices, video metadata playback, admin/agent evidence visibility, agent notifications, bilingual complaint and Tamil reply using controlled translation API responses, speech transcript cancellation remark and customer privacy.
- Existing booking, review, agent account/password and mobile checks passed without uncaught JavaScript errors or horizontal overflow.
- Physical phone camera/microphone and live paid translation API were not tested. Voice support depends on browser and language availability; typed input remains available. Automatic regional UI/content translation requires backend OPENAI_API_KEY and API credits. Without it originals remain visible. Translation accuracy across every language is not certified.
- Browser harness removed only its in-memory global request limiter because all test roles shared one IP; packaged application retains the limiter.

## Translation repair regression

- Five backend tests passed: existing authorization/evidence/booking coverage plus offline Hindi, missing key, invalid key, quota errors and retry recovery. English complaint target respects the profile setting. Provider errors use controlled responses; no live paid API accuracy claim.
- Frontend production build passed. Browser regression passed for offline Hindi agent navigation/profile labels, missing-key explanation and Bengali UI translations recovering after a failed request using Retry translation. Bilingual complaints/Tamil replies, photo/video evidence, private voice remarks and previous role/mobile flows also passed using simulated devices and controlled translations.

## Live evidence and closed complaint update

- Five backend tests passed including authenticated live-capture challenges, one-use capture-token enforcement, five-photo limit, two-video limit, 121-second video rejection, valid short-video uploads, 15-minute expiry and closed ticket reply/media rejection. Agent and admin closure both checked.
- Production build passed. Browser checks passed: removed complaint language dropdown, simulated Hindi speech transcript in reply textarea, live camera photo and video capture, staff evidence visibility, locked customer reply UI, agent complaint creation and admin visibility. Existing role/contact/booking/mobile and controlled regional translation retry tests passed.
- Physical microphones/cameras were not tested; browser speech service, device permissions and HTTPS are needed. Speech uses profile language, not universal automatic spoken-language detection. Arbitrary text translation and non-Hindi UI translation still need a configured valid translation API key and credits; translation tests use controlled responses, not live accuracy tests.
- Evidence window starts on complaint creation. A live capture challenge and restricted camera UI establish the normal fresh-capture workflow; they do not attest physical-device authenticity. Videos are silent and limited to 20 MB as well as 120 seconds.
