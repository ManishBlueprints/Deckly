import { DeckLink } from "../types";
import { getDeckLinkShareUrl } from "../utils/url";
import { normalizeSlug } from "../utils/slug";
import { supabase } from "./supabase";
import { getRequiredDeckUserId } from "./deckService.shared";
import { userService } from "./userService";
import { withRetry } from "../utils/resilience";

type DeckOwnerMeta = {
  deckId: string;
  slug: string;
  userId: string;
  workspaceSlug: string;
};

type DeckLinkRow = Omit<DeckLink, "share_url">;

type CreateDeckLinkInput = {
  linkName?: string;
  linkAlias?: string;
};

async function getDeckOwnerMeta(
  deckId: string,
  providedUserId?: string,
): Promise<DeckOwnerMeta> {
  const userId = await getRequiredDeckUserId(providedUserId);

  const { data: deck, error: deckError } = await supabase
    .from("decks")
    .select("id, slug, user_id")
    .eq("id", deckId)
    .eq("user_id", userId)
    .single();

  if (deckError) throw deckError;

  const profile = await userService.getProfile(userId);
  if (!profile?.handle) {
    throw new Error("A workspace slug is required before generating deck link URLs.");
  }

  return {
    deckId: deck.id,
    slug: deck.slug,
    userId: deck.user_id,
    workspaceSlug: profile.handle,
  };
}

function hydrateDeckLinks(
  links: DeckLinkRow[],
  ownerMeta: DeckOwnerMeta,
): DeckLink[] {
  return links.map((link) => ({
    ...link,
    share_url: getDeckLinkShareUrl(
      ownerMeta.workspaceSlug,
      link.link_alias || ownerMeta.slug,
    ),
  }));
}

export const deckLinkService = {
  async listDeckLinks(deckId: string, providedUserId?: string): Promise<DeckLink[]> {
    return withRetry(async () => {
      const ownerMeta = await getDeckOwnerMeta(deckId, providedUserId);

      const { data, error } = await supabase
        .from("deck_links")
        .select("id, deck_id, link_name, link_alias, public_token, is_enabled, is_primary, created_at, updated_at")
        .eq("deck_id", ownerMeta.deckId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      return hydrateDeckLinks((data ?? []) as DeckLinkRow[], ownerMeta);
    });
  },

  async createDeckLink(
    deckId: string,
    inputOrUserId?: CreateDeckLinkInput | string,
    providedUserId?: string,
  ): Promise<DeckLink> {
    return withRetry(async () => {
      const input =
        typeof inputOrUserId === "string" || inputOrUserId === undefined
          ? undefined
          : inputOrUserId;
      const resolvedUserId =
        typeof inputOrUserId === "string" ? inputOrUserId : providedUserId;
      const ownerMeta = await getDeckOwnerMeta(deckId, resolvedUserId);
      const existingLinks = await this.listDeckLinks(deckId, ownerMeta.userId);
      const normalizedAlias = input?.linkAlias ? normalizeSlug(input.linkAlias) : null;
      const trimmedName = input?.linkName?.trim();
      const linkName =
        trimmedName && trimmedName.length > 0
          ? trimmedName
          : existingLinks.length === 0
            ? "Default Link"
            : `Link ${existingLinks.length + 1}`;

      const { data, error } = await supabase
        .from("deck_links")
        .insert({
          deck_id: ownerMeta.deckId,
          link_name: linkName,
          link_alias: normalizedAlias,
          is_enabled: false,
          is_primary: existingLinks.length === 0,
        })
        .select("id, deck_id, link_name, link_alias, public_token, is_enabled, is_primary, created_at, updated_at")
        .single();

      if (error) throw error;

      return hydrateDeckLinks([data as DeckLinkRow], ownerMeta)[0];
    });
  },

  async enableDeckLink(
    deckId: string,
    linkId: string,
    providedUserId?: string,
  ): Promise<DeckLink> {
    return withRetry(async () => {
      const ownerMeta = await getDeckOwnerMeta(deckId, providedUserId);

      const { data, error } = await supabase
        .from("deck_links")
        .update({
          is_enabled: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", linkId)
        .eq("deck_id", ownerMeta.deckId)
        .select("id, deck_id, link_name, link_alias, public_token, is_enabled, is_primary, created_at, updated_at")
        .single();

      if (error) throw error;

      return hydrateDeckLinks([data as DeckLinkRow], ownerMeta)[0];
    });
  },

  async disableDeckLink(
    deckId: string,
    linkId: string,
    providedUserId?: string,
  ): Promise<DeckLink> {
    return withRetry(async () => {
      const ownerMeta = await getDeckOwnerMeta(deckId, providedUserId);

      const { data, error } = await supabase
        .from("deck_links")
        .update({
          is_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", linkId)
        .eq("deck_id", ownerMeta.deckId)
        .select("id, deck_id, link_name, link_alias, public_token, is_enabled, is_primary, created_at, updated_at")
        .single();

      if (error) throw error;

      return hydrateDeckLinks([data as DeckLinkRow], ownerMeta)[0];
    });
  },

  async deleteDeckLink(
    deckId: string,
    linkId: string,
    providedUserId?: string,
  ): Promise<void> {
    return withRetry(async () => {
      const ownerMeta = await getDeckOwnerMeta(deckId, providedUserId);

      const { error } = await supabase
        .from("deck_links")
        .delete()
        .eq("id", linkId)
        .eq("deck_id", ownerMeta.deckId);

      if (error) throw error;
    });
  },

  async getDeckLinkShareUrl(
    deckId: string,
    linkAlias?: string | null,
    providedUserId?: string,
  ): Promise<string> {
    const ownerMeta = await getDeckOwnerMeta(deckId, providedUserId);

    return getDeckLinkShareUrl(
      ownerMeta.workspaceSlug,
      linkAlias || ownerMeta.slug,
    );
  },
};
