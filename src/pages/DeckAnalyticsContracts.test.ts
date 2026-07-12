/// <reference types="vitest/globals" />

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pageSource = readFileSync(path.resolve(__dirname, "DeckAnalytics.tsx"), "utf8");

describe("DeckAnalytics link analytics states", () => {
  it("keeps loading, failure, and empty states distinct", () => {
    expect(pageSource).toContain("isLoading: linksLoading");
    expect(pageSource).toContain("isError: linksError");
    expect(pageSource).toContain("linksLoading ? (");
    expect(pageSource).toContain("linksError ? (");
    expect(pageSource).toContain("linkStats.length === 0 ? (");
    expect(pageSource).toContain("refetch: refetchLinkStats");
  });
});
