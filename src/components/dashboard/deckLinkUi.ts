import { DeckLink, DeckWithAnalytics } from "../../types";

export type DeckLinkSummary = {
  summary: string;
  helper: string;
  isActive: boolean;
};

export function getDeckLinkSummary(
  totalLinkCount: number,
  activeLinkCount: number,
): DeckLinkSummary {
  if (totalLinkCount <= 0) {
    return {
      summary: "No links yet",
      helper: "Create a link to start sharing",
      isActive: false,
    };
  }

  if (activeLinkCount <= 0) {
    if (totalLinkCount === 1) {
      return {
        summary: "1 link · private",
        helper: "Enable a link before copying",
        isActive: false,
      };
    }

    return {
      summary: `${totalLinkCount} links · private`,
      helper: "Enable a link before copying",
      isActive: false,
    };
  }

  return {
    summary: `${totalLinkCount} link${totalLinkCount === 1 ? "" : "s"} · ${activeLinkCount} active`,
    helper: "Primary link ready to copy",
    isActive: true,
  };
}

export function getPrimaryDeckLink(links: DeckLink[]): DeckLink | undefined {
  return links.find((link) => link.is_primary);
}

export function canCopyPrimaryDeckLink(deck: DeckWithAnalytics): boolean {
  return (deck.active_link_count ?? 0) > 0;
}

