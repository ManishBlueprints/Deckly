type ServerAnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export async function capturePostHogEvent(
  event: string,
  distinctId: string,
  properties: ServerAnalyticsProperties,
): Promise<void> {
  const apiKey = Deno.env.get("POSTHOG_PROJECT_API_KEY")?.trim();
  if (!apiKey) return;

  const configuredHost = Deno.env.get("POSTHOG_INGESTION_HOST")?.trim();
  const host = (configuredHost || "https://us.i.posthog.com").replace(/\/$/, "");
  const safeProperties = Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined),
  );

  const response = await fetch(`${host}/i/v0/e/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      event,
      properties: {
        distinct_id: distinctId,
        ...safeProperties,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`PostHog ingestion failed with status ${response.status}`);
  }
}
