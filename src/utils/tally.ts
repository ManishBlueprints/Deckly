export function buildTallyEmbedUrl(
  baseUrl: string,
  params: Record<string, string>,
): string {
  const url = new URL(baseUrl);

  if (url.pathname.startsWith("/r/")) {
    url.pathname = url.pathname.replace("/r/", "/embed/");
  } else if (!url.pathname.startsWith("/embed/")) {
    url.pathname = `/embed${url.pathname.startsWith("/") ? url.pathname : `/${url.pathname}`}`;
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
