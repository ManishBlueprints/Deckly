export function buildTallyEmbedUrl(
  baseUrl: string,
  params: Record<string, string>,
): string {
  const url = new URL(baseUrl);
  const isSharePath = url.pathname.startsWith("/r/");
  const isEmbedPath = url.pathname.startsWith("/embed/");

  if (url.protocol !== "https:") {
    throw new Error("Tally feedback URL must use HTTPS.");
  }

  if (url.hostname !== "tally.so") {
    throw new Error("Tally feedback URL must use the tally.so domain.");
  }

  if (!isSharePath && !isEmbedPath) {
    throw new Error("Tally feedback URL must use a share or embed path.");
  }

  if (isSharePath) {
    url.pathname = url.pathname.replace("/r/", "/embed/");
  }

  url.searchParams.set("alignLeft", "1");
  url.searchParams.set("hideTitle", "1");
  url.searchParams.set("dynamicHeight", "1");

  Object.entries(params).forEach(([key, value]) => {
    if (value.trim()) {
      url.searchParams.set(key, value);
    }
  });

  return url.toString();
}
