# Developer Documentation - Deckly

Deckly is a React 19 + Supabase workspace for founders and investors. This guide is the lightweight repo-level developer overview.

## Tech stack

- Frontend: React 19 + Vite + TypeScript
- Styling: Tailwind CSS + shadcn/ui
- Backend: Supabase Auth + Postgres + Storage + RPCs
- Data fetching: TanStack Query v5
- Document processing: `pdfjs-dist` in-browser + Supabase Edge Function for Office conversion
- Analytics: PostHog + Supabase analytics RPCs

## Current architecture

```text
src/
├── components/
│   ├── dashboard/
│   │   └── manage-deck/          # Split ManageDeck UI sections
│   ├── notifications/
│   ├── ui/
│   └── viewer/
├── contexts/
├── hooks/
│   └── useManageDeckWorkflow.ts  # Upload/edit orchestration
├── pages/
│   ├── ManageDeck.tsx            # Composition + form state
│   ├── Viewer.tsx
│   └── DataRoomViewer.tsx
├── services/
│   ├── authSession.ts
│   ├── deckService.ts            # Composed facade
│   ├── deckStorageService.ts
│   ├── deckLibraryService.ts
│   ├── deckBrandingService.ts
│   ├── dataRoomService.ts
│   ├── noteService.ts
│   └── organizerService.ts
├── workflows/
│   └── deckProcessing.ts
└── utils/
```

## Local development

```bash
npm install
npm run dev
```

Deckly uses the **Supabase CLI** for a robust, version-controlled database workflow. This ensures consistency between local development and production.

#### 100% CLI-First Mandate

> [!IMPORTANT]
> **NEVER** edit the database schema directly in the Supabase Dashboard SQL Editor for features intended for the repository. The CLI is the exclusive source of truth.

#### Local Infrastructure & One-Click Setup

To start the local database, auth, and storage services:

```bash
npx supabase start
```

This uses the consolidated **`00000000000000_initial_schema.sql`** baseline to prepare a production-ready environment in one click. To wipe and re-sync your local state to the latest baseline:

```bash
npx supabase db reset
```

#### Schema Changes

1. **Create a new migration**: `npx supabase migration new your_feature_name`
2. **Author SQL**: Write your DDL/DML in the generated file in `supabase/migrations/`.
3. **Apply locally**: Run `npx supabase db reset` to verify the migration executes correctly.
4. **Verify**: Ensure the application functions as expected with the new schema.

#### Database Branching & Deployment

For production updates, we use:

```bash
npx supabase db push
```

This pushes your locally verified migrations to the linked production project.

1. Copy `.env.example` to `.env.local` (or `.env`):
   ```bash
   cp .env.example .env.local
   ```
2. Set the required environment variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL.
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase publishable key (browser-safe).
   - `PROJECT_SECRET_KEY`: (Server-side/Edge Functions) Your project's service_role or secret key. Used by Edge Functions to authorize owner-mode operations (like signed URL generation) without exposing the key to the browser.
   - `VITE_PUBLIC_POSTHOG_KEY`: (Optional) Your PostHog project API key.
   - `VITE_PUBLIC_POSTHOG_HOST`: (Optional) Your PostHog host (e.g., `https://app.posthog.com`).

> [!IMPORTANT]
> Never commit your `.env.local` or any file containing secrets to version control.

After configuring your environment, ensure you run `npm install` to keep dependencies in sync before starting the development server.

Before merging code, run:

```bash
npm run type-check
npm run lint
npm test
```

## Service conventions

- Prefer shared auth helpers over ad-hoc `supabase.auth.getSession()` calls
- Keep service modules focused by concern
- Put shared processing/orchestration in `workflows/` or dedicated hooks, not inside page components
- Keep TanStack Query keys centralized inside hooks when optimistic updates are involved

## Current known docs note

- `docs/.vitepress/theme/index.ts` still has 3 pre-existing lint warnings for unused args. They are docs-only and do not block app verification.
