import { supabase } from "../services/supabase";
import { deckService } from "../services/deckService";
import { Deck } from "../types";

export type SignedUrlMeta = {
  handle: string | null;
  slug: string;
  password?: string;
  expiresIn: number;
};

export type ViewerLoadResult = {
  deck: Deck;
  isOwner: boolean;
  isUnlocked: boolean;
  analyticsDeck?: Deck;
  signedUrlMeta?: SignedUrlMeta;
};

export type ViewerUnlockResult = {
  resolvedDeck: Partial<Deck>;
  signedUrlMeta?: SignedUrlMeta;
};

const resolveSignedPayload = (
  payload: Awaited<ReturnType<typeof deckService.getDeckPayload>>,
  identity: { handle: string | null; slug: string },
): ViewerUnlockResult => {
  const resolvedDeck = payload.signed_url
    ? { ...payload, file_url: payload.signed_url, expires_in: payload.expires_in }
    : payload;

  return {
    resolvedDeck,
    signedUrlMeta:
      payload.signed_url && payload.expires_in
        ? {
            handle: identity.handle,
            slug: identity.slug,
            expiresIn: payload.expires_in,
          }
        : undefined,
  };
};

export async function loadViewerDeck({
  handle,
  slug,
  getDeckByHandleAndSlug = deckService.getDeckByHandleAndSlug.bind(deckService),
  getDeckPayload = deckService.getDeckPayload.bind(deckService),
  getDeckById = deckService.getDeckById.bind(deckService),
  getCurrentSessionUserId = async () => {
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession();
    return currentSession?.user?.id;
  },
}: {
  handle: string;
  slug: string;
  getDeckByHandleAndSlug?: typeof deckService.getDeckByHandleAndSlug;
  getDeckPayload?: typeof deckService.getDeckPayload;
  getDeckById?: typeof deckService.getDeckById;
  getCurrentSessionUserId?: () => Promise<string | undefined>;
}): Promise<ViewerLoadResult> {
  const data = await getDeckByHandleAndSlug(handle, slug);
  const currentUserId = await getCurrentSessionUserId();
  const userIsOwner =
    currentUserId !== undefined &&
    currentUserId !== null &&
    data.user_id !== undefined &&
    data.user_id !== null &&
    currentUserId === data.user_id;

  if ((!data.require_email && !data.require_password) || userIsOwner) {
    if (userIsOwner) {
      const fullDeck = await getDeckById(data.id);
      return {
        deck: fullDeck,
        isOwner: true,
        isUnlocked: true,
      };
    }

    try {
      const payload = await getDeckPayload(slug, undefined, handle);
      const { resolvedDeck, signedUrlMeta } = resolveSignedPayload(payload, {
        handle,
        slug,
      });

      return {
        deck: { ...data, ...resolvedDeck },
        isOwner: false,
        isUnlocked: true,
        analyticsDeck: data,
        signedUrlMeta: signedUrlMeta ? { ...signedUrlMeta } : undefined,
      };
    } catch {
      throw new Error("Failed to load document content.");
    }
  }

  return {
    deck: data,
    isOwner: userIsOwner,
    isUnlocked: false,
  };
}

export async function unlockViewerDeck({
  handle,
  password,
  slug,
  getDeckPayload = deckService.getDeckPayload.bind(deckService),
}: {
  handle: string | null;
  password?: string;
  slug: string;
  getDeckPayload?: typeof deckService.getDeckPayload;
}): Promise<ViewerUnlockResult> {
  const payload = await getDeckPayload(slug, password, handle);
  const { resolvedDeck, signedUrlMeta } = resolveSignedPayload(payload, {
    handle,
    slug,
  });

  return {
    resolvedDeck,
    signedUrlMeta: signedUrlMeta
      ? {
          ...signedUrlMeta,
          handle,
          slug,
          password,
        }
      : undefined,
  };
}

export async function refreshViewerSignedUrl({
  meta,
  getDeckPayload = deckService.getDeckPayload.bind(deckService),
}: {
  meta: SignedUrlMeta;
  getDeckPayload?: typeof deckService.getDeckPayload;
}): Promise<{ fileUrl?: string; signedUrlMeta?: SignedUrlMeta }> {
  const refreshed = await getDeckPayload(meta.slug, meta.password, meta.handle);

  if (!refreshed.signed_url) {
    return { signedUrlMeta: meta };
  }

  return {
    fileUrl: refreshed.signed_url,
    signedUrlMeta: {
      handle: meta.handle,
      slug: meta.slug,
      password: meta.password,
      expiresIn: refreshed.expires_in ?? meta.expiresIn,
    },
  };
}
