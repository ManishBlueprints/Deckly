# Deckly Vulnerability Analysis Report

Date: 2026-05-28  
Scope: Static repository and local configuration review. No live penetration testing was performed.

## Executive Summary

This project is a Vite/React application backed by Supabase, Supabase Edge Functions, Vercel API routes, Cloudflare R2 storage, AI document analysis, PostHog, Sentry, and public sharing routes for decks/data rooms.

The strongest security controls observed are:

- Authenticated dashboard routes are guarded in `src/App.tsx`.
- Supabase RLS is broadly enabled for owner-owned data.
- Private deck storage access is mediated through signed URLs and server/Edge Function checks.
- Public data exposure is mostly routed through security-definer RPCs instead of raw table access.
- PDF parsing disables eval support in the extraction route.

The main security concerns are:

- Current production dependency audit reports 8 advisories, including high-severity `protobufjs` issues flowing through telemetry dependencies.
- `.env.local` contains real deployment/service-secret key names locally; this is expected for development but increases workstation and accidental-disclosure risk.
- Public functions use permissive CORS and some return backend/RPC error details to unauthenticated callers.
- R2 signed URL lifetimes are long or caller-controlled in some flows.
- Guest AI quota uses forwarded IP headers, which are only trustworthy when the deployment platform normalizes them.
- Document extraction can process many documents concurrently and forwards uploaded business documents to ConvertAPI for Office conversion.

## Findings Overview

| ID | Severity | Area | Finding |
| --- | --- | --- | --- |
| F-01 | High | Dependencies | Production audit reports high-severity transitive advisories in `protobufjs` through `posthog-js`/OpenTelemetry. |
| F-02 | High | Secrets/config | Local `.env.local` contains service and third-party secrets; values are gitignored but still high-value workstation secrets. |
| F-03 | Medium | Storage signing | `r2-storage` accepts caller-supplied signed URL expiration without an upper bound. |
| F-04 | Medium | Public signing | `sign-deck-url` returns 6-hour signed deck/page URLs. |
| F-05 | Medium | Error disclosure | Public signing function returns raw RPC messages for unauthorized deck/room access failures. |
| F-06 | Medium | CORS | Edge storage/signing/AI functions use `Access-Control-Allow-Origin: *`. |
| F-07 | Medium | AI quota | Guest AI quota derives identity from forwarded IP headers. |
| F-08 | Medium | Document extraction | Office document conversion sends private files to ConvertAPI and logs storage paths/metadata. |
| F-09 | Medium | Document extraction | Extraction processes all unique documents concurrently, risking resource exhaustion on large rooms. |
| F-10 | Medium | Privacy | Analytics and telemetry identify users and visitors with email/user traits. |
| F-11 | Low | Local storage | Viewer email and pending action state are stored in browser localStorage. |
| F-12 | Low | Embeds | Office/Tally iframe embeds lack explicit sandbox/referrer policies. |
| F-13 | Low | Admin | Admin allowlist is email-based, which is simple but operationally fragile. |
| F-14 | Positive | XSS | No `dangerouslySetInnerHTML`, direct `innerHTML`, `eval`, or `new Function` usage found in `src`. |

## Detailed Findings

### F-01: Production Dependency Advisories

Severity: High  
Status: Confirmed by `npm audit --omit=dev --json`

Evidence:

- `package.json:42` uses `posthog-js`.
- `package.json:66` uses `postcss`.
- `package.json:75-77` pins `protobufjs` via overrides.
- `package-lock.json:7639` locks `posthog-js@1.336.4`.
- `package-lock.json:7711` locks `protobufjs@7.5.5`.
- `package-lock.json:7483` locks `postcss@8.5.6`.

Audit result:

- 8 total production advisories: 5 high, 3 moderate.
- High advisories include `protobufjs` code injection / denial-of-service / prototype pollution related advisories.
- `posthog-js` pulls vulnerable OpenTelemetry/protobuf paths.
- `postcss` is below the fixed range for a moderate XSS advisory.
- `ws` was reported by audit as moderate, although the lockfile currently shows `ws@8.18.3`; re-run after dependency updates to confirm final state.

Impact:

- The highest risk is supply-chain exposure in telemetry/parsing dependencies.
- `protobufjs` advisories include code generation and denial-of-service classes of bugs. Even when reachable only through telemetry, these are worth treating as release blockers.

Recommended remediation:

- Upgrade or pin to versions with fixed advisories once available.
- Reassess the `protobufjs` override; pinning `7.5.5` currently keeps known advisory exposure.
- Run `npm audit --omit=dev` in CI and fail on high/critical production advisories.
- If `posthog-js` cannot be upgraded safely, consider disabling OpenTelemetry-related paths or replacing the telemetry client until fixed.

### F-02: Local Secrets Present In `.env.local`

Severity: High  
Status: Confirmed by key-name inspection only; secret values were not read into this report.

Evidence:

- `.gitignore` ignores `.env.local` via `*.local` and `.env.local`.
- `.env.local` includes key names for Supabase, Sentry, OpenRouter, Cloudflare/R2, and asset gateways.
- `.env.example:38-55` documents service-role, project secret, OpenRouter, R2 secret, ConvertAPI, and cron secret variables.
- `vite.config.ts:168` reads `SENTRY_AUTH_TOKEN`.

Impact:

- These secrets are high-value. If the workstation, terminal history, editor telemetry, crash reports, or screenshots leak them, attackers may access storage, AI spend, Sentry release upload, or Supabase privileged operations depending on the exposed value.
- This is not a committed-secret finding, but it is a local operational risk.

Recommended remediation:

- Keep `.env.local` out of screenshots, support logs, and AI/chat uploads.
- Rotate any key that may have been copied into external tools.
- Prefer separate development keys with least privilege.
- Ensure browser-exposed keys are only `VITE_*` values meant for public use.
- Do not define service-role-equivalent keys in frontend runtime environments.

### F-03: Caller-Controlled R2 Signed URL Expiry

Severity: Medium  
Status: Confirmed

Evidence:

- `supabase/functions/r2-storage/index.ts:157` reads `body.expiresInSeconds`.
- `supabase/functions/r2-storage/index.ts:169` passes that value to `createSignedUrls`.
- User-prefix checks exist at `supabase/functions/r2-storage/index.ts:93`, `117`, `128`, and `165`.

Impact:

- Authenticated users can request signed URLs for their own paths, but there is no visible maximum expiry clamp.
- A compromised user session could mint very long-lived URLs for private deck assets.
- Long-lived signed URLs are bearer tokens; anyone who receives the URL can fetch the object until expiry.

Recommended remediation:

- Clamp `expiresInSeconds` to a small maximum, such as 300-3600 seconds.
- Use separate upper bounds for owner dashboard thumbnails versus full deck assets.
- Add tests proving excessive values are reduced.

### F-04: Six-Hour Public Deck Signed URLs

Severity: Medium  
Status: Confirmed

Evidence:

- `supabase/functions/sign-deck-url/index.ts:203` sets `EXPIRES_IN_SECONDS = 21600`.
- `supabase/functions/sign-deck-url/index.ts:204` signs requested deck paths with that expiry.
- Public route access exists at `src/App.tsx:308-309`.

Impact:

- After a viewer passes password/email/expiry checks, generated asset URLs remain usable for 6 hours, even if the deck is quickly made private, password is changed, or access is otherwise revoked.
- This is a common signed-URL tradeoff, but 6 hours is generous for sensitive pitch decks.

Recommended remediation:

- Reduce signed URL lifetime for public viewers to 5-30 minutes.
- Add refresh-on-demand in the viewer if longer sessions are needed.
- Consider invalidating access using object versioning or path rotation when privacy settings change.

### F-05: Public Auth Failure Details Leak RPC Messages

Severity: Medium  
Status: Confirmed

Evidence:

- `supabase/functions/sign-deck-url/index.ts:97-105` logs and returns `rpcError.message` for data room payload failures.
- `supabase/functions/sign-deck-url/index.ts:134-142` logs and returns `rpcError.message` for deck payload failures.

Impact:

- Unauthenticated callers can receive implementation-specific messages from Supabase RPCs.
- These messages can help enumerate whether a handle/slug exists, whether a password is required, whether an item expired, or how backend checks are structured.

Recommended remediation:

- Return a generic client message, such as `Access denied`.
- Keep detailed error messages server-side only.
- Normalize 403 responses across missing, expired, private, and wrong-password states where feasible.

### F-06: Permissive CORS On Edge Functions

Severity: Medium  
Status: Confirmed

Evidence:

- `supabase/functions/r2-storage/index.ts:30` sets `Access-Control-Allow-Origin: *`.
- `supabase/functions/sign-deck-url/index.ts:22` and `222` set `Access-Control-Allow-Origin: *`.
- `supabase/functions/ai-summary/index.ts` defines broad CORS headers near the top of the function.

Impact:

- Bearer-token-protected functions remain protected by auth checks, but permissive CORS allows any website to call the function from a victim browser if it can obtain or induce credentials in headers.
- This increases blast radius for XSS in another origin, malicious browser extensions, and token exfiltration scenarios.

Recommended remediation:

- Restrict CORS to known application origins such as app/share domains and localhost in development.
- Return `Vary: Origin` when dynamically reflecting allowed origins.
- Keep `OPTIONS` responses aligned with the same origin allowlist.

### F-07: Guest AI Quota Relies On Forwarded IP Headers

Severity: Medium  
Status: Confirmed

Evidence:

- `supabase/functions/ai-summary/index.ts:400-404` reads `x-forwarded-for`, `x-real-ip`, and `cf-connecting-ip`.
- Guest quota recording uses `ai_guest_usage` around `supabase/functions/ai-summary/index.ts:627` and `651`.
- Guest summaries are allowed for public decks at `supabase/functions/ai-summary/index.ts:1328-1341`.

Impact:

- If the runtime does not strip or normalize incoming forwarded headers, clients can spoof IP values and bypass guest quota.
- This can become an AI-cost abuse vector against public decks.

Recommended remediation:

- Use platform-provided trusted client IP metadata where available.
- Only trust `cf-connecting-ip` if traffic is guaranteed to arrive through Cloudflare.
- Add secondary quota dimensions, such as anonymous device fingerprint, deck scope, and daily global cap.

### F-08: Private Office Documents Are Sent To ConvertAPI

Severity: Medium  
Status: Confirmed

Evidence:

- `api/extract-document-text.ts:582-584` requires `CONVERT_API_SECRET`.
- `api/extract-document-text.ts:599-618` posts Office files to ConvertAPI.
- `api/extract-document-text.ts:644-650` downloads the converted PDF.
- `api/extract-document-text.ts:685`, `694`, and related logs include storage paths and document metadata.

Impact:

- DOC/DOCX/PPT/PPTX/XLS/XLSX content leaves the application's infrastructure and is processed by a third party.
- Pitch decks and data room documents are often confidential; this should be explicit in product privacy terms and vendor risk review.
- Storage paths in logs are not direct secrets but may reveal user IDs, deck names, or document organization.

Recommended remediation:

- Document ConvertAPI as a subprocessors/vendor dependency.
- Add user-visible disclosure for AI/document extraction features.
- Redact or hash storage paths in logs where operationally possible.
- Consider local/server-side conversion for higher-trust tiers.

### F-09: Unbounded Concurrent Document Extraction Per Scope

Severity: Medium  
Status: Confirmed

Evidence:

- `api/extract-document-text.ts:882-883` sets a per-document timeout.
- `api/extract-document-text.ts:925-949` processes all unique documents with `Promise.allSettled`.
- `api/extract-document-text.ts:1012-1026` permits authenticated folder/data room extraction and guest deck extraction.

Impact:

- A large data room can trigger many concurrent R2 downloads, PDF parses, and third-party conversions.
- This can exhaust Vercel function time/memory, increase ConvertAPI spend, or degrade service for other users.

Recommended remediation:

- Add a concurrency limiter, for example 2-4 documents at a time.
- Add a maximum document count and maximum byte size per extraction request.
- Queue extraction as a background job for large rooms.

### F-10: Analytics And Error Telemetry Include Personal Data

Severity: Medium  
Status: Confirmed

Evidence:

- `src/contexts/AuthContext.tsx:53-58` identifies PostHog/Sentry users with email and full name.
- `src/services/analyticsService.ts:145` identifies users in analytics.
- `src/services/analyticsService.ts:170-175` persists a local visitor ID.
- `supabase/schema.sql:1349-1438` records page views including viewer email and location fields.

Impact:

- User and investor identity data flows to PostHog, Sentry, and Supabase analytics tables.
- This may be acceptable, but it is privacy-sensitive and should be disclosed and minimized.

Recommended remediation:

- Review privacy policy and data processing agreements for telemetry providers.
- Consider hashing or suppressing email in client telemetry.
- Add retention policies for page-view and visitor data.
- Ensure users can request deletion/export of analytics records tied to their identity.

### F-11: Email And Pending Actions Stored In Local Storage

Severity: Low  
Status: Confirmed

Evidence:

- `src/components/viewer/AccessGate.tsx:30-37` reads cached viewer email from localStorage.
- `src/components/viewer/AccessGate.tsx:73-79` stores viewer email with a 24-hour TTL.
- `src/pages/Viewer.tsx:223-247` stores pending deck save action state.
- `src/pages/DataRoomViewer.tsx:195-299` stores pending data room actions.

Impact:

- localStorage is readable by any script running in the origin.
- If XSS is introduced later, cached viewer emails and pending actions become accessible.

Recommended remediation:

- Store only non-sensitive pending action flags in localStorage.
- Prefer sessionStorage for short-lived viewer emails, or avoid caching email by default.
- Keep XSS regression tests/linting because localStorage raises XSS impact.

### F-12: Iframe Embeds Lack Sandbox/Referrer Policy

Severity: Low  
Status: Confirmed

Evidence:

- `src/components/viewer/DeckViewer.tsx:165` renders an Office viewer iframe.
- `src/pages/Feedback.tsx:78` renders a feedback iframe.

Impact:

- Third-party embedded content can receive referrer context and may run with more browser capability than necessary.
- This is lower risk because iframes are not same-origin by default, but sandboxing improves isolation.

Recommended remediation:

- Add `sandbox` with the minimum required permissions.
- Add `referrerPolicy="no-referrer"` or an intentionally chosen policy.
- Consider `allow` attributes only for capabilities the embed truly needs.

### F-13: Email-Based Admin Allowlist

Severity: Low  
Status: Confirmed

Evidence:

- `supabase/schema.sql:2047-2052` defines `admin_emails`.
- `supabase/schema.sql:2056-2075` implements `is_admin` by matching `auth.users.email`.
- `supabase/schema.sql:2480-2498` exposes `get_total_system_users` to authenticated users but enforces `is_admin` internally.
- `src/App.tsx:297-298` routes `/admin` through session gating, and `src/pages/AdminDashboard.tsx` verifies admin status before rendering.

Impact:

- Email allowlists are easy to operate but can break if a user's email changes.
- Depending on auth provider configuration, unverified email states or provider-linked email changes may need explicit review.

Recommended remediation:

- Tie admin authorization to immutable user IDs or a role claim/table keyed by user ID.
- Require email verification before admin status can be effective.
- Add audit logging for admin broadcasts and admin allowlist changes.

### F-14: XSS Sink Search Looks Clean

Severity: Positive finding  
Status: Confirmed by static search

Evidence:

- Search across `src` found no `dangerouslySetInnerHTML`, direct `innerHTML`, `eval(`, or `new Function`.
- React rendering is used for user-visible UI.

Impact:

- The current client code avoids the most obvious DOM XSS primitives.
- This does not eliminate XSS risk from dependencies, markdown rendering, PDFs, iframes, or future changes.

Recommended remediation:

- Keep this as a regression check in security review.
- If markdown/HTML rendering is introduced, require DOMPurify or a similarly reviewed sanitizer.

## Page And Feature Review

### Global Routing And Auth

Evidence:

- Protected routes are wrapped by `requireSession` in `src/App.tsx:203-306`.
- Public routes are `/:handle/room/:slug`, `/:handle/:slug`, and legacy `/:slug` in `src/App.tsx:308-311`.

Assessment:

- Dashboard routes are client-gated, but backend/RLS remains the true security boundary.
- Public viewer routes are intentionally unauthenticated and depend on RPC/password/signed URL checks.

Risks:

- Any data exposed through public RPCs must be treated as internet-visible.
- Legacy slug redirects can be used for slug enumeration if backend responses differ measurably.

Recommendations:

- Keep public RPC responses generic.
- Add automated tests for unauthenticated access to private deck/room payloads.

### Login, Signup, Onboarding, Profile

Assessment:

- Supabase Auth is used, and auth state is centrally managed.
- Profile and branding loading errors block authenticated workspace rendering.
- `signOutAllDevices` uses Supabase global signout.
- Account deletion calls a server function through `userService.deleteAccount`.

Risks:

- PostHog/Sentry identify calls include email/full name.
- Account deletion must remain server-enforced; the client route itself is not a security boundary.

Recommendations:

- Verify `delete-account` requires the user's JWT and does not accept target user IDs from the client.
- Minimize telemetry traits.

### Home, Content, Upload, Manage Deck

Assessment:

- Routes are authenticated through `requireSession`.
- Uploads go through R2 signed upload via `storageService` and `r2-storage`.
- Storage object policies enforce user ID path prefix ownership.

Risks:

- User-controlled file extensions and file content are accepted for deck/document workflows.
- Signed upload and signed read URLs should have tight expiry.

Recommendations:

- Enforce MIME/type/size limits in both client and server-side signing path.
- Clamp signed URL expiry.
- Scan or restrict dangerous document formats if public downloading is introduced.

### Viewer And Public Deck Access

Assessment:

- Public deck viewer is intentionally unauthenticated.
- `AccessGate` supports email/password gating and caches viewer email for 24 hours.
- `sign-deck-url` re-checks deck/data-room authorization before signing requested paths.

Risks:

- Six-hour signed URLs are long-lived bearer access.
- RPC error messages are exposed.
- Email-only gates identify viewers but do not authenticate them.

Recommendations:

- Shorten signed URL lifetime.
- Normalize failure responses.
- Make clear in UI/product language that email gate is tracking/lead capture, not authentication.

### Data Rooms

Assessment:

- Authenticated owner routes are protected.
- Public data room viewer is routed separately.
- Data room documents have owner-management policies and a public document-list policy in schema.

Risks:

- The policy named `Anyone can view data room document lists` should be reviewed carefully against expected public metadata exposure.
- Data room extraction can process many documents concurrently.

Recommendations:

- Confirm public document-list policy exposes only intended metadata.
- Add regression tests for private data room document visibility.
- Queue or limit extraction.

### Saved Library, Notes, Tags

Assessment:

- RLS policies indicate saved rooms, investor library, notes, folders, and tags are owner-scoped.
- Notes policies are labeled strictly private.

Risks:

- Cross-feature RPCs such as library metadata hydration must keep ownership checks in place.

Recommendations:

- Add tests that a user cannot read/write another user's saved notes, folders, tags, or library entries.

### Analytics

Assessment:

- Page views are written via `record_deck_visit` security-definer function.
- Viewer email/location and visitor IDs are collected.

Risks:

- Visitor identifiers and emails are privacy-sensitive.
- Analytics write functions are available to anon/authenticated callers and must remain sanitized/rate-limited.

Recommendations:

- Add retention and deletion policies for analytics data.
- Keep rate-limit and sanitization tests for `record_deck_visit`.

### Admin Dashboard And Notifications

Assessment:

- `/admin` is session-gated and page code calls server-side admin checks.
- Admin functions use `is_admin` before privileged work.

Risks:

- Admin authorization depends on email allowlist.
- Broadcast functions should be audited for content abuse and logging.

Recommendations:

- Prefer user-ID based admin roles.
- Add audit log rows for broadcasts and admin actions.

### AI Summary And Chat

Assessment:

- Signed-in chat requires authentication and scope access checks.
- Guest summaries are limited to public decks.
- Service-role client is used server-side only.

Risks:

- Guest quota may be bypassable if forwarded IP headers are spoofable.
- AI requests can create spend exposure.
- User/deck content is sent to OpenRouter.

Recommendations:

- Add trusted-IP handling and global AI spend caps.
- Add user-visible disclosure that AI summaries send document text to the configured AI provider.
- Add max question length and request body size limits.

### Document Extraction

Assessment:

- Authenticated users can extract folder/data-room scopes; guests can extract public deck scope only.
- PDF parsing uses `isEvalSupported: false`.
- Office docs are converted through ConvertAPI.

Risks:

- Concurrent processing can exhaust runtime resources.
- Third-party conversion is a confidentiality concern.
- Stack traces are logged server-side on failure at `api/extract-document-text.ts:1037`.

Recommendations:

- Add concurrency and file count/size limits.
- Redact logs.
- Add vendor disclosure and retention review.

## Configuration Review

### Public Environment Variables

Browser-safe public variables are expected to use `VITE_*`, such as:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_TURNSTILE_SITE_KEY`
- `VITE_TALLY_FEEDBACK_URL`
- `VITE_R2_PUBLIC_ASSET_BASE_URL`
- `VITE_R2_PRIVATE_GATEWAY_BASE_URL`

Notes:

- `VITE_*` values are exposed to browser bundles by design.
- Do not place service-role, R2 secret, OpenRouter, Sentry auth token, ConvertAPI, or cron secrets behind a `VITE_` prefix.

### Server Secret Variables

Server-only variables documented in `.env.example` include:

- `SUPABASE_SERVICE_ROLE_KEY`
- `PROJECT_SECRET_KEY`
- `OPENROUTER_API_KEY`
- `R2_SECRET_ACCESS_KEY`
- `CONVERT_API_SECRET`
- `CRON_SECRET`
- `SENTRY_AUTH_TOKEN`

Recommendations:

- Rotate these periodically and after any accidental disclosure.
- Scope provider keys as narrowly as possible.
- Keep separate dev/staging/prod values.

## Prioritized Remediation Checklist

1. Fix production dependency advisories, especially `protobufjs` and `posthog-js` transitive advisories.
2. Clamp all signed URL expirations; reduce public viewer signed URLs from 6 hours.
3. Replace public RPC error messages with generic access-denied responses.
4. Restrict Edge Function CORS to approved origins.
5. Harden AI guest quota against spoofed IP headers and add global spend caps.
6. Add extraction concurrency/file count/file size limits.
7. Review ConvertAPI/OpenRouter/PostHog/Sentry subprocessors and update privacy disclosures.
8. Add sandbox/referrer policies to third-party iframes.
9. Move admin authorization from email allowlist to immutable user ID/role records.
10. Add security regression tests for private deck, private room, saved library, notes, tags, and analytics access.

## Test Evidence Collected

Commands/checks used:

- `rg --files`
- `git status --short`
- `npm audit --omit=dev --json`
- Searches for XSS sinks: `dangerouslySetInnerHTML`, `innerHTML`, `eval(`, `new Function`
- Searches for secret usage, signed URL generation, storage paths, RLS policies, public RPC grants, and auth checks
- Manual review of:
  - `src/App.tsx`
  - `src/contexts/AuthContext.tsx`
  - `src/components/viewer/AccessGate.tsx`
  - `src/components/viewer/DeckViewer.tsx`
  - `supabase/functions/r2-storage/index.ts`
  - `supabase/functions/sign-deck-url/index.ts`
  - `supabase/functions/ai-summary/index.ts`
  - `api/extract-document-text.ts`
  - `supabase/schema.sql`
  - `package.json`
  - `.env.example`

## Limitations

- This was not a live penetration test.
- Supabase deployed RLS state, storage bucket ACLs, function deployment secrets, CDN headers, and production CORS behavior were not dynamically tested.
- `.env.local` secret values were not included in this report.
- Dependency advisories reflect the npm audit result at the time of the scan.

## Remediation Tracker

- Fix now: `F-01`, `F-02`, `F-03`, `F-05`, `F-06`, `F-07`, `F-09`, and the DeckAnalytics IDOR/Semgrep path.
- Untouched for this pass: `F-04`, `F-08`, `F-10`.
- Low-severity Semgrep findings such as typed-regex and logging warnings remain for a later pass unless they overlap with files we already change.
