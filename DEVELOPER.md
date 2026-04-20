# Developer Documentation - Deckly

Deckly is a React 19 + Supabase workspace for founders and investors. This guide is the lightweight repo-level developer overview. For the fuller internal docs set, use the files under `docs/`.

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

## Important refactors already landed

- `ManageDeck` is no longer a single workflow-heavy page. The upload/edit flow is split across:
  - `src/pages/ManageDeck.tsx`
  - `src/hooks/useManageDeckWorkflow.ts`
  - `src/components/dashboard/manage-deck/ManageDeckSections.tsx`
- Shared PDF processing now lives in `src/workflows/deckProcessing.ts`
- `deckService` was split internally into focused modules while preserving the public `deckService.*` API
- Auth/session resolution is being standardized through `src/services/authSession.ts`
- The Vitest pipeline is healthy again and `npm test` is trustworthy

## Local development

```bash
npm install
npm run dev
```

### Environment setup

1. Copy `.env.example` to `.env.local` (or `.env`):
   ```bash
   cp .env.example .env.local
   ```
2. Set the required environment variables:
   - `VITE_SUPABASE_URL`: Your Supabase project URL (found in Project Settings > API).
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase publishable key (found in Project Settings > API).
   - `PROJECT_SECRET_KEY`: (Server-side/Edge Functions) Your Supabase secret key.
   - `VITE_POSTHOG_KEY`: (Optional) Your PostHog project API key.
   - `VITE_POSTHOG_HOST`: (Optional) Your PostHog host (e.g., `https://app.posthog.com`).

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
