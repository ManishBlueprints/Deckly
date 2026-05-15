import { describe, expect, it, vi } from "vitest";
import type { Deck } from "../types";

vi.mock("../components/viewer/ImageDeckViewer", () => ({
  default: () => null,
}));
vi.mock("../components/viewer/DeckViewer", () => ({
  default: () => null,
}));
vi.mock("../components/viewer/AccessGate", () => ({
  default: () => null,
}));
vi.mock("../components/auth/AuthModal", () => ({
  AuthModal: () => null,
}));
vi.mock("../components/viewer/NotesSidebar", () => ({
  NotesSidebar: () => null,
}));
vi.mock("../hooks/useViewerQueries", () => ({
  useIsDeckSaved: () => ({ data: false }),
  useSaveToLibraryMutation: () => ({ isPending: false, mutate: vi.fn() }),
}));
vi.mock("../services/analyticsService", () => ({
  analyticsService: {
    trackDeckView: vi.fn(),
  },
}));
vi.mock("../services/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));
vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ session: null }),
}));

import {
  loadViewerDeck,
  refreshViewerSignedUrl,
  unlockViewerDeck,
} from "./viewerPublicAccess";

const baseDeck = {
  id: "deck-1",
  user_id: "owner-1",
  slug: "seed-round",
  title: "Seed Round",
  file_url: "https://example.com/original.pdf",
  display_order: 0,
  created_at: "2026-05-14T00:00:00.000Z",
  require_email: false,
  require_password: false,
  display_mode: "pdf",
  pages: [],
  status: "PROCESSED",
} as unknown as Deck;

describe("Viewer public link flows", () => {
  it("threads handle and alias path through the initial public deck load", async () => {
    const getDeckByHandleAndSlug = vi.fn().mockResolvedValue(baseDeck);
    const getDeckPayload = vi.fn().mockResolvedValue({
      file_url: "https://example.com/original.pdf",
      signed_url: "https://signed.example.com/seed.pdf",
      expires_in: 21600,
      pages: [],
    });
    const result = await loadViewerDeck({
      handle: "founder",
      slug: "investor-follow-up",
      getDeckByHandleAndSlug,
      getDeckPayload,
      getCurrentSessionUserId: async () => undefined,
    });

    expect(getDeckByHandleAndSlug).toHaveBeenCalledWith("founder", "investor-follow-up");
    expect(getDeckPayload).toHaveBeenCalledWith("investor-follow-up", undefined, "founder");
    expect(result.isUnlocked).toBe(true);
    expect(result.signedUrlMeta).toMatchObject({
      handle: "founder",
      slug: "investor-follow-up",
      expiresIn: 21600,
    });
  });

  it("threads handle and alias path through password unlock", async () => {
    const getDeckPayload = vi.fn().mockResolvedValue({
      file_url: "https://example.com/original.pdf",
      signed_url: "https://signed.example.com/unlocked.pdf",
      expires_in: 21600,
      pages: [],
    });

    const result = await unlockViewerDeck({
      handle: "founder",
      password: "letmein",
      slug: "investor-follow-up",
      getDeckPayload,
    });

    expect(getDeckPayload).toHaveBeenCalledWith("investor-follow-up", "letmein", "founder");
    expect(result.signedUrlMeta).toMatchObject({
      handle: "founder",
      slug: "investor-follow-up",
      password: "letmein",
      expiresIn: 21600,
    });
  });

  it("reuses handle and alias path for signed-url refresh revalidation", async () => {
    const getDeckPayload = vi.fn().mockResolvedValue({
      file_url: "https://example.com/original.pdf",
      signed_url: "https://signed.example.com/refreshed.pdf",
      expires_in: 120,
      pages: [],
    });

    const result = await refreshViewerSignedUrl({
      meta: {
        handle: "founder",
        slug: "investor-follow-up",
        password: "letmein",
        expiresIn: 60,
      },
      getDeckPayload,
    });

    expect(getDeckPayload).toHaveBeenCalledWith("investor-follow-up", "letmein", "founder");
    expect(result).toEqual({
      fileUrl: "https://signed.example.com/refreshed.pdf",
      signedUrlMeta: {
        handle: "founder",
        slug: "investor-follow-up",
        password: "letmein",
        expiresIn: 120,
      },
    });
  });

  it("does not fall back to bare-slug compatibility for invalid or disabled alias routes", async () => {
    await expect(
      loadViewerDeck({
        handle: "founder",
        slug: "investor-follow-up",
        getDeckByHandleAndSlug: vi.fn().mockRejectedValue(new Error("Deck not found or access denied")),
      }),
    ).rejects.toThrow("Deck not found or access denied");
  });

  it("fails closed on the next signed-url revalidation after alias link disablement", async () => {
    const getDeckPayload = vi.fn().mockRejectedValue(new Error("Deck not found or access denied"));

    await expect(
      refreshViewerSignedUrl({
        meta: {
          handle: "founder",
          slug: "investor-follow-up",
          password: "letmein",
          expiresIn: 21600,
        },
        getDeckPayload,
      }),
    ).rejects.toThrow("Deck not found or access denied");

    expect(getDeckPayload).toHaveBeenCalledWith("investor-follow-up", "letmein", "founder");
  });

  it("lets owners unlock their own deck route without public-link gating", async () => {
    const getDeckByHandleAndSlug = vi.fn().mockResolvedValue(baseDeck);
    const getDeckById = vi.fn().mockResolvedValue({
      ...baseDeck,
      pages: [{ image_url: "https://example.com/slide-1.png", page_number: 1 }],
    });
    const getDeckPayload = vi.fn();

    const result = await loadViewerDeck({
      handle: "founder",
      slug: "seed-round",
      getDeckByHandleAndSlug,
      getDeckById,
      getDeckPayload,
      getCurrentSessionUserId: async () => "owner-1",
    });

    expect(getDeckByHandleAndSlug).toHaveBeenCalledWith("founder", "seed-round");
    expect(getDeckById).toHaveBeenCalledWith("deck-1");
    expect(getDeckPayload).not.toHaveBeenCalled();
    expect(result.isOwner).toBe(true);
    expect(result.isUnlocked).toBe(true);
  });
});
