export function formatLinkCreatedAt(createdAt: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(createdAt));
}

export function splitShareUrl(
  shareUrl: string,
): { origin: string; pathWithQuery: string } {
  try {
    const url = new URL(shareUrl);
    return {
      origin: url.origin,
      pathWithQuery: `${url.pathname}${url.search}`,
    };
  } catch (err) {
    // `new URL()` throws a TypeError on invalid input; keep callers safe.
    if (err instanceof TypeError) {
      return { origin: "", pathWithQuery: shareUrl || "" };
    }

    throw err;
  }
}
