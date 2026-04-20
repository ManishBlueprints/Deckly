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

- **Node.js**: v20+ (required for the latest build pipeline)
- **Supabase**: A project with `decks` storage bucket and `schema.sql` applied.

### Setup

1. **Clone & Install**:

   ```bash
   git clone https://github.com/ManishBlueprints/Deckly.git
   cd Deckly
   npm install
   ```

2. **Configure Environment**:

   ```bash
   cp .env.example .env.local
   # Fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
   ```

3. **Database Setup**:
   Copy the contents of `supabase/schema.sql` and run it in your Supabase SQL Editor.

### Launch

#### Local Node.js

```bash
npm run dev
```

### Quality checks

```bash
npm run type-check
npm run lint
npm test
```

Vitest is now part of the normal local workflow and should be considered a trusted signal before shipping changes.

#### Docker Development

The project includes a pre-configured Docker setup using **Node 20-alpine**.

```bash
docker-compose up
```

The application will be available at `http://localhost:5173`.

---

## 📖 Extended Documentation

Coming Soon

Built with ❤️ for the startup community. Star this repo if you find it useful.
