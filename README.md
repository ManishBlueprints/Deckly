# 🚀 Deckly | Easy Pitchdeck Workspace

### A shared deck workspace for founders and investors (https://deckly.space)

**Deckly** is an open-source pitch deck workspace built for both founders and investors. Founders can share and update decks effortlessly, while investors get a clean system to manage, review, and remember what matters. Designed for speed, privacy, and simplicity.

---

## Key Features

- **Smooth, App-Like Deck Viewing**  
  A custom slide-based viewer that turns static PDFs into fast, responsive experiences with a native-app feel on any device.

- **Client-Side Rendering**  
  Decks are processed directly in the browser into high-resolution slides, reducing backend load and improving privacy and speed.

- **Same-Link Deck Updates**  
  Replace or update your pitch deck while keeping the **same shareable link** — no need to resend links after small fixes or iterations.

- **Data Rooms (Multiple Decks)**  
  Group related decks into data rooms for structured sharing during fundraising or reviews.

- **Link Expiration & Access Control**  
  Set expiration dates, disable downloads, and control how your deck is accessed.

- **One-Click Sharing**  
  Instant share links with clipboard feedback for a frictionless workflow.

- **Investor-Friendly Experience**  
  Investors can save decks, add private notes, tag startups, and revisit decks without losing context.

- **AI-Powered Deck Summaries**  
  Automatically generate concise, investor-focused summaries to quickly understand what a deck is about.

- **Built-in Analytics**  
  Track deck engagement, slide drop-offs, and revisit signals using PostHog — with configurable analytics retention.

- **Privacy-First by Design**  
  No forced email capture, optional anonymous viewing, and minimal data collection by default.

- **Mobile-First UI**  
  Native app feel with bottom navigation and responsive dashboard layouts, optimized for founders on the move.

- **Secure Account Deletion**  
  Permanent and recursive data purging ensures all storage assets and database records are permanently wiped upon account closure.

---

## 🛠️ Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL + RLS + Storage)
- **Data Fetching**: [TanStack Query v5](https://tanstack.com/query/latest)
- **PDF Engine**: [pdf.js](https://mozilla.github.io/pdf.js/) (Client-side rendering)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/)
- **Analytics**: [PostHog](https://posthog.com/)

---

## 📁 Project Architecture

```text
src/
├── components/     # Shared UI plus feature-facing dashboard/viewer sections
├── contexts/       # Auth, Tier Gating, and Branding state
├── hooks/          # Query hooks and workflow hooks
├── pages/          # Route containers like Viewer, DataRoomViewer, ManageDeck
├── services/       # Composed service facade + focused service modules
├── workflows/      # Shared document/deck processing flows
└── utils/          # URL generation, resilience, slug helpers
```

Recent internal cleanup moved the repo toward clearer boundaries:

- `ManageDeck` now uses a workflow hook and split presentational sections
- shared PDF/document processing lives in `src/workflows/deckProcessing.ts`
- `deckService` is a composed facade over storage, branding, and library modules
- auth/session lookup is being standardized through shared service helpers

Whether you want to self-host your own private Data Room or contribute to the next generation of founder tools, the code is yours to explore, modify, and deploy under the **GNU AGPL v3**.

## 📜 License

Deckly is licensed under the **GNU Affero General Public License v3 (AGPL-3.0)**.

### Section 13: Network Interaction & Source Distribution

> [!IMPORTANT]
> Because Deckly is licensed under the AGPL, **Section 13 (Remote Network Interaction)** is in effect. If you modify the software and run it on a server for other users to interact with over a network, you **must** provide those users with an opportunity to receive the Corresponding Source of your modified version.

#### How to provide "Corresponding Source":

1.  **Keep the Source Link:** We recommend keeping a "View Source" or "Source Code" link in the footer of your deployed application that points to your public repository (e.g., on GitHub or GitLab).
2.  **Facilitate Access:** The source code must be provided through a standard or customary means of facilitating copying of software, at no charge.
3.  **Complete Source:** The source you provide must include all modifications, scripts, and interface definition files needed to generate, install, and run the version you have deployed.

For more details, see the full [LICENSE](./LICENSE) file.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v20+
- **Docker**: Required for local Supabase development environment.
- **Supabase CLI**: (Optional) Use `npx supabase` or install globally.

### Canonical Supabase Files

Deckly keeps the install surface intentionally small:

- [`supabase/schema.sql`](./supabase/schema.sql) is the human-readable canonical snapshot.
- [`supabase/migrations/`](./supabase/migrations) is the executable history that Supabase replays.
- [`supabase/seed.sql`](./supabase/seed.sql) stays minimal and non-production.
- [`supabase/bootstrap/verify.sql`](./supabase/bootstrap/verify.sql) verifies a fresh install.
- [`scripts/bootstrap-supabase.mjs`](./scripts/bootstrap-supabase.mjs) is the one command entrypoint.

### Fresh Install

1. **Clone and install**

   ```bash
   git clone https://github.com/ManishBlueprints/Deckly.git
   cd Deckly
   npm install
   cp .env.example .env.local
   ```

2. **Configure app env**

   Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for your target project.
   For local development they usually point at:

   ```bash
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=your_local_publishable_key
   ```

3. **Bootstrap Supabase**

   - Local stack:

     ```bash
     npm run supabase:bootstrap -- local
     ```

   - Fresh linked Supabase project:

     ```bash
     npx supabase login
     npm run supabase:bootstrap -- remote --project-ref YOUR_PROJECT_REF
     ```

     Optional but recommended:

     ```bash
     SUPABASE_DB_PASSWORD=your_database_password
     SUPABASE_ADMIN_EMAIL=you@yourcompany.com
     ```

   The bootstrap script will link the project, push the migrations, seed the database, and run a verification query.

### Local Development

```bash
npm run dev
```

If you want to refresh the local database again later, rerun:

```bash
npm run supabase:bootstrap -- local
```

### Quality Checks

```bash
npm run type-check
npm run lint
npm test
```

### Docker Development

The project includes a pre-configured Docker setup using **Node 20-alpine**.

```bash
docker-compose up
```

The application will be available at `http://localhost:5173`.

### Open-Source Self-Hosting

If you are replicating Deckly in your own Supabase account:

1. Run `npx supabase login`.
2. Create a fresh Supabase project.
3. Bootstrap it with `npm run supabase:bootstrap -- remote --project-ref YOUR_PROJECT_REF`.
4. Set the required app env vars in `.env.local`.
5. Start the app with `npm run dev`.

If you want an initial admin email, pass `SUPABASE_ADMIN_EMAIL` during bootstrap or insert your own row into `public.admin_emails` after setup.

---

## 📖 Extended Documentation

Coming Soon

Built with ❤️ for the startup community. Star this repo if you find it useful.
