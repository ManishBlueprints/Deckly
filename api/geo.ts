export const config = {
  runtime: 'edge',
};

// Safe URI decoder that falls back gracefully on malformed encodings
function safeDecodeURIComponent(encoded: string): string {
  try {
    return decodeURIComponent(encoded);
  } catch {
    // Malformed URI component (e.g., incomplete UTF-8 sequence)
    return encoded;
  }
}

export default async function handler(req: Request) {
  // Vercel automatically injects these headers on the Edge Network
  // x-vercel-ip-country returns ISO 3166-1 country code (e.g., "US", "GB")
  const country = req.headers.get('x-vercel-ip-country') || 'Unknown';
  // City names are URL-encoded by Vercel, need to decode safely
  const cityEncoded = req.headers.get('x-vercel-ip-city') || 'Unknown City';
  const city = safeDecodeURIComponent(cityEncoded);
  const country_code = req.headers.get('x-vercel-ip-country') || 'US';

  return new Response(
    JSON.stringify({ 
      country, 
      city, 
      country_code 
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    }
  );
}
