/// <reference types="node" />
/// <reference types="vitest/globals" />
import {
  getDeckPath,
  getDataRoomPath,
  getDeckShareUrl,
  getDeckLinkShareUrl,
  getDataRoomShareUrl,
  getDeckPreviewPath,
  getDataRoomPreviewPath,
} from "./url";

describe("url utilities", () => {
  describe("Path Generation", () => {
    it("generates correct deck path", () => {
      expect(getDeckPath("manish", "my-deck")).toBe("/manish/my-deck");
    });

    it("encodes handle and slug in deck path", () => {
      expect(getDeckPath("manish kumar", "deck & room")).toBe("/manish%20kumar/deck%20%26%20room");
    });

    it("generates correct data room path", () => {
      expect(getDataRoomPath("manish", "room-slug")).toBe("/manish/room/room-slug");
    });

    it("encodes handle and slug in data room path", () => {
      // encodeURIComponent does not encode ! but encodes @
      expect(getDataRoomPath("manish!", "data@room")).toBe("/manish!/room/data%40room");
    });

    it("generates correct deck preview path", () => {
      expect(getDeckPreviewPath("deck-123")).toBe("/preview/deck/deck-123");
    });

    it("generates correct data room preview path", () => {
      expect(getDataRoomPreviewPath("room-123")).toBe("/preview/room/room-123");
    });

  });

  describe("Origin and Full URLs", () => {
    const originalEnv = process.env.BASE_URL;

    afterEach(() => {
      process.env.BASE_URL = originalEnv;
      vi.unstubAllGlobals();
    });

    it("uses window.location.origin if available", () => {
      vi.stubGlobal("window", {
        location: { origin: "https://deckly.space" }
      });
      expect(getDeckShareUrl("user", "deck")).toBe("https://deckly.space/user/deck");
    });

    it("falls back to process.env.BASE_URL if window is undefined", () => {
      vi.stubGlobal("window", undefined);
      process.env.BASE_URL = "https://staging.deckly.space";
      expect(getDataRoomShareUrl("user", "room")).toBe("https://staging.deckly.space/user/room/room");
    });

    it("defaults to localhost if no window or env var exists", () => {
      vi.stubGlobal("window", undefined);
      delete process.env.BASE_URL;
      expect(getDeckShareUrl("u", "d")).toBe("http://localhost:5173/u/d");
    });

    it("builds deck link share URLs without a link token", () => {
      vi.stubGlobal("window", {
        location: { origin: "https://deckly.space" }
      });

      expect(
        getDeckLinkShareUrl(
          "user",
          "deck",
        ),
      ).toBe("https://deckly.space/user/deck");
    });

    it("builds deck link share URLs with a custom alias path", () => {
      vi.stubGlobal("window", {
        location: { origin: "https://deckly.space" }
      });

      expect(
        getDeckLinkShareUrl(
          "user",
          "investor-follow-up",
        ),
      ).toBe("https://deckly.space/user/investor-follow-up");
    });
  });
});
