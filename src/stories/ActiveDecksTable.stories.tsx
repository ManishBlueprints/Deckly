import type { Meta, StoryObj } from "@storybook/react-vite";
import { MemoryRouter } from "react-router-dom";
import {
  ActiveDecksTableView,
  type ActiveDeckViewModel,
} from "../components/dashboard/ActiveDecksTable";

const decks: ActiveDeckViewModel[] = [
  {
    id: "deck-series-a",
    title: "Series A Narrative",
    activeLinkCount: 2,
    status: "active",
    lastActivity: "2026-08-20T09:15:00+05:30",
    views: 128,
    avgAttention: 164,
    saves: 14,
  },
  {
    id: "deck-product",
    title: "Product Strategy and Market Expansion",
    activeLinkCount: 1,
    status: "active",
    lastActivity: "2026-08-19T16:30:00+05:30",
    views: 72,
    avgAttention: 96,
    saves: 8,
  },
  {
    id: "deck-diligence",
    title: "Diligence Data Pack",
    activeLinkCount: 0,
    status: "processing",
    lastActivity: "2026-08-18T11:00:00+05:30",
    views: 0,
    saves: 0,
  },
];

const meta = {
  title: "Screens/Overview/Active decks",
  component: ActiveDecksTableView,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <main className="mx-auto max-w-6xl p-5 sm:p-8">
          <h1 className="sr-only">Overview active decks</h1>
          <Story />
        </main>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof ActiveDecksTableView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = { args: { decks } };
export const Empty: Story = { args: { decks: [] } };
export const Loading: Story = { args: { decks: [], loading: true } };
export const Refreshing: Story = { args: { decks, refreshing: true } };
