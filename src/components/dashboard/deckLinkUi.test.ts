/// <reference types="vitest/globals" />

import { canCopyPrimaryDeckLink, getDeckLinkSummary, getPrimaryDeckLink } from "./deckLinkUi";

describe("deckLinkUi helpers", () => {
  it("summarizes decks with no links", () => {
    expect(getDeckLinkSummary(0, 0)).toEqual({
      summary: "No links yet",
      helper: "Create a link to start sharing",
      isActive: false,
    });
  });

  it("summarizes private-only link states", () => {
    expect(getDeckLinkSummary(1, 0)).toEqual({
      summary: "1 link · private",
      helper: "Enable a link before copying",
      isActive: false,
    });

    expect(getDeckLinkSummary(3, 0)).toEqual({
      summary: "3 links · private",
      helper: "Enable a link before copying",
      isActive: false,
    });
  });

  it("summarizes active link counts", () => {
    expect(getDeckLinkSummary(2, 1)).toEqual({
      summary: "2 links · 1 active",
      helper: "Primary link ready to copy",
      isActive: true,
    });
  });

  it("detects whether quick-copy is available from deck aggregates", () => {
    expect(
      canCopyPrimaryDeckLink({
        id: "deck-1",
        title: "Deck",
        slug: "deck",
        file_url: "",
        status: "PROCESSED",
        user_id: "user-1",
        display_order: 0,
        pages: [],
        created_at: new Date().toISOString(),
        total_views: 0,
        save_count: 0,
        last_viewed_at: null,
        active_link_count: 0,
        total_link_count: 1,
      }),
    ).toBe(false);

    expect(
      canCopyPrimaryDeckLink({
        id: "deck-2",
        title: "Deck",
        slug: "deck",
        file_url: "",
        status: "PROCESSED",
        user_id: "user-1",
        display_order: 0,
        pages: [],
        created_at: new Date().toISOString(),
        total_views: 0,
        save_count: 0,
        last_viewed_at: null,
        active_link_count: 1,
        total_link_count: 2,
      }),
    ).toBe(true);
  });

  it("returns the primary deck link when present", () => {
    expect(
      getPrimaryDeckLink([
        {
          id: "secondary",
          deck_id: "deck-1",
          link_name: "Follow-up Link",
          link_alias: "follow-up-link",
          public_token: "0123456789abcdef0123456789abcdef",
          is_enabled: true,
          is_primary: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          share_url: "https://deckly.space/demo/deck?link=0123456789abcdef0123456789abcdef",
        },
        {
          id: "primary",
          deck_id: "deck-1",
          link_name: "Default Link",
          link_alias: "demo-deck",
          public_token: "fedcba9876543210fedcba9876543210",
          is_enabled: true,
          is_primary: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          share_url: "https://deckly.space/demo/deck?link=fedcba9876543210fedcba9876543210",
        },
      ])?.id,
    ).toBe("primary");
  });
});
