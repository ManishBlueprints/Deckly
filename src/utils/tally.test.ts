import { describe, expect, it } from "vitest";
import { buildTallyEmbedUrl } from "./tally";

describe("buildTallyEmbedUrl", () => {
  it("converts a Tally share url to the embed url and appends params", () => {
    const result = buildTallyEmbedUrl("https://tally.so/r/WOl6Va", {
      email: "user@example.com",
      handle: "manish",
      user_id: "123",
      workspace: "Deckly",
      source: "deckly-app",
      page: "/feedback",
    });

    const url = new URL(result);

    expect(url.origin).toBe("https://tally.so");
    expect(url.pathname).toBe("/embed/WOl6Va");
    expect(url.searchParams.get("alignLeft")).toBe("1");
    expect(url.searchParams.get("hideTitle")).toBe("1");
    expect(url.searchParams.get("dynamicHeight")).toBe("1");
    expect(url.searchParams.get("email")).toBe("user@example.com");
    expect(url.searchParams.get("handle")).toBe("manish");
    expect(url.searchParams.get("user_id")).toBe("123");
    expect(url.searchParams.get("workspace")).toBe("Deckly");
    expect(url.searchParams.get("source")).toBe("deckly-app");
    expect(url.searchParams.get("page")).toBe("/feedback");
  });

  it("keeps an existing embed path and skips empty params", () => {
    const result = buildTallyEmbedUrl("https://tally.so/embed/WOl6Va", {
      email: "",
      handle: "   ",
      user_id: "abc",
      workspace: "",
      source: "deckly-app",
      page: "",
    });

    const url = new URL(result);

    expect(url.pathname).toBe("/embed/WOl6Va");
    expect(url.searchParams.get("user_id")).toBe("abc");
    expect(url.searchParams.get("source")).toBe("deckly-app");
    expect(url.searchParams.has("email")).toBe(false);
    expect(url.searchParams.has("handle")).toBe(false);
    expect(url.searchParams.has("workspace")).toBe(false);
    expect(url.searchParams.has("page")).toBe(false);
  });
});
