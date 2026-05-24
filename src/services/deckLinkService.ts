import { DeckLink } from "../types";
import { getDeckLinkShareUrl } from "../utils/url.ts";
import { normalizeSlug } from "../utils/slug.ts";
import { supabase } from "./supabase.ts";
import { getRequiredDeckUserId } from "./deckService.shared.ts";
import { userService } from "./userService.ts";
import { withRetry } from "../utils/resilience.ts";

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

const DECK_LINK_CREATE_CONFLICT_RETRIES = 3;

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === "23505"
  );
}

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
    input: CreateDeckLinkInput,
    providedUserId?: string,
  ): Promise<DeckLink> {
    const hasExplicitAlias = Boolean(input?.linkAlias && input.linkAlias.trim().length > 0);

    const prepareInsert = async () => {
      const ownerMeta = await getDeckOwnerMeta(deckId, providedUserId);
      const existingLinks = await this.listDeckLinks(deckId, ownerMeta.userId);
      const existingAliases = new Set(
        existingLinks
          .map((link) => link.link_alias)
          .filter((alias): alias is string => Boolean(alias)),
      );

      let normalizedAlias = hasExplicitAlias ? normalizeSlug(input.linkAlias!) : null;
      if (hasExplicitAlias && !normalizedAlias) {
        throw new Error("Link alias must contain at least one letter or number.");
      }
      const trimmedName = input?.linkName?.trim();
      const linkName =
        trimmedName && trimmedName.length > 0
          ? trimmedName
          : existingLinks.length === 0
            ? "Default Link"
            : `Link ${existingLinks.length + 1}`;

      // Primary link can safely omit alias (it resolves to the deck slug).
      // Non-primary links must have a unique public path to avoid share URL collisions.
      if (existingLinks.length > 0 && !normalizedAlias) {
        const baseAlias = normalizeSlug(ownerMeta.slug) || "deck-link";
        let idx = existingLinks.length + 1;
        let candidate = `${baseAlias}-link${idx}`;
        while (existingAliases.has(candidate)) {
          idx += 1;
          candidate = `${baseAlias}-link${idx}`;
        }
        normalizedAlias = candidate;
      }

      return {
        ownerMeta,
        existingAliases,
        linkName,
        normalizedAlias,
        isPrimary: existingLinks.length === 0,
      };
    };

    for (let attempt = 0; attempt <= DECK_LINK_CREATE_CONFLICT_RETRIES; attempt += 1) {
      const prepared = await withRetry(prepareInsert);

      const { data, error } = await supabase
        .from("deck_links")
        .insert({
          deck_id: prepared.ownerMeta.deckId,
          link_name: prepared.linkName,
          link_alias: prepared.normalizedAlias,
          is_enabled: false,
          is_primary: prepared.isPrimary,
        })
        .select("id, deck_id, link_name, link_alias, public_token, is_enabled, is_primary, created_at, updated_at")
        .single();

      if (!error) {
        return hydrateDeckLinks([data as DeckLinkRow], prepared.ownerMeta)[0];
      }

      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      if (hasExplicitAlias) {
        const refreshed = await withRetry(prepareInsert);
        if (
          refreshed.normalizedAlias &&
          refreshed.existingAliases.has(refreshed.normalizedAlias)
        ) {
          throw new Error("Link alias is already in use.");
        }
      }

      if (attempt === DECK_LINK_CREATE_CONFLICT_RETRIES) {
        throw error;
      }
    }

    throw new Error("Failed to create deck link.");
  },

  async createDefaultDeckLink(
    deckId: string,
    providedUserId?: string,
  ): Promise<DeckLink> {
    return this.createDeckLink(deckId, {}, providedUserId);
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
    const ownerMeta = await withRetry(() => getDeckOwnerMeta(deckId, providedUserId));

    return getDeckLinkShareUrl(
      ownerMeta.workspaceSlug,
      linkAlias || ownerMeta.slug,
    );
  },
};
