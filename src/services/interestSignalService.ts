import { supabase } from "./supabase";

// Signal labels — neutral, factual language
export type SignalLabel =
  | "Revisited"
  | "Viewed multiple times"
  | "Spent time on key slides"
  | "Returned quickly"
  | "Extended viewing";

export interface SlideTime {
  page: number;
  time: number;
}

export interface DeckVisitSummary {
  deckId: string;
  totalVisits: number;
  totalTime: number;
}

export interface VisitorSignal {
  visitorId: string;
  viewerEmail: string | null;
  totalVisits: number;
  totalTime: number;
  distinctDays: number;
  deepSlides: number;
  daysBetweenFirstAndLast: number | null;
  signals: SignalLabel[];
  slideBreakdown: SlideTime[];
  deckBreakdown?: DeckVisitSummary[];
  isEngaged: boolean;
}

interface PageViewRow {
  visitor_id: string;
  page_number: number;
  viewed_at: string;
  time_spent: number | null;
  viewer_email: string | null;
  deck_id?: string;
  data_room_id?: string | null;
}

/**
 * Compute investor interest signals for a specific deck.
 * All signals are derived from existing `deck_page_views` data.
 * Results are sorted by signal strength (most signals first).
 */
export async function getVisitorSignals(
  deckId: string,
): Promise<VisitorSignal[]> {
  const { data, error } = await supabase
    .from("deck_page_views")
    .select("visitor_id, page_number, viewed_at, time_spent, viewer_email")
    .eq("deck_id", deckId)
    .order("viewed_at", { ascending: true });

  if (error) {
    console.error("Error fetching page views for signals:", error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Group rows by visitor_id
  const byVisitor = new Map<string, PageViewRow[]>();
  for (const row of data as PageViewRow[]) {
    const existing = byVisitor.get(row.visitor_id) || [];
    existing.push(row);
    byVisitor.set(row.visitor_id, existing);
  }

  const results: VisitorSignal[] = [];

  for (const [visitorId, rows] of byVisitor) {
    const signals: SignalLabel[] = [];

    // Find the email (take the first non-null email for this visitor)
    const viewerEmail = rows.find((r) => r.viewer_email)?.viewer_email || null;

    // Distinct calendar days this visitor viewed the deck
    const uniqueDays = new Set(
      rows.map((r) => new Date(r.viewed_at).toDateString()),
    );
    const distinctDays = uniqueDays.size;

    // Total rows = total slide views
    const totalVisits = rows.length;

    // Total time across all slides
    const totalTime = rows.reduce((sum, r) => sum + (r.time_spent || 0), 0);

    // Slides where visitor spent ≥ 20 seconds
    const deepSlides = new Set(
      rows
        .filter((r) => (r.time_spent || 0) >= 20)
        .map((r) => r.page_number),
    ).size;

    // Days between first and last visit
    const dates = rows
      .map((r) => new Date(r.viewed_at).getTime())
      .sort((a, b) => a - b);
    const daysBetween = dates.length >= 2
      ? Math.round(
        (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24),
      )
      : null;

    // --- Apply signal rules ---

    // 1. Revisited: ≥ 2 distinct days
    if (distinctDays >= 2) {
      signals.push("Revisited");
    }

    // 2. Viewed multiple times: ≥ 3 total slide views
    if (totalVisits >= 3) {
      signals.push("Viewed multiple times");
    }

    // 3. Deep read: ≥ 2 slides with 20s+ time
    if (deepSlides >= 2) {
      signals.push("Spent time on key slides");
    }

    // 4. Quick return: revisited within 3 days
    if (daysBetween !== null && daysBetween <= 3 && distinctDays >= 2) {
      signals.push("Returned quickly");
    }

    // 5. Long session: total time ≥ 60 seconds
    if (totalTime >= 60) {
      signals.push("Extended viewing");
    }

    // Build per-slide time breakdown (aggregate time per slide for this visitor)
    const slideMap = new Map<number, number>();
    for (const r of rows) {
      slideMap.set(
        r.page_number,
        (slideMap.get(r.page_number) || 0) + (r.time_spent || 0),
      );
    }
    const slideBreakdown: SlideTime[] = Array.from(slideMap.entries())
      .map(([page, time]) => ({ page, time: Math.round(time) }))
      .sort((a, b) => a.page - b.page);

    // Include all visitors — even those with no behavioral signals yet
    results.push({
      visitorId,
      viewerEmail,
      totalVisits,
      totalTime: Math.round(totalTime),
      distinctDays,
      deepSlides,
      daysBetweenFirstAndLast: daysBetween,
      signals,
      slideBreakdown,
      isEngaged: signals.length > 0,
    });
  }

  // Sort: visitors with more signals first, then by total time
  results.sort((a, b) =>
    b.signals.length - a.signals.length || b.totalTime - a.totalTime
  );

  return results;
}

/**
 * Quick check: does this deck have any interest signals?
 * Lighter query for dashboard summaries.
 */
export async function getDeckSignalCount(
  deckId: string,
): Promise<number> {
  const signals = await getVisitorSignals(deckId);
  return signals.length;
}

/**
 * Compute investor interest signals for an entire Data Room.
 */
export async function getRoomVisitorSignals(
  roomId: string,
): Promise<VisitorSignal[]> {
  // 1. First, get all visitor IDs who have viewed anything IN this room
  const { data: roomVisitors, error: visitorError } = await supabase
    .from("deck_page_views")
    .select("visitor_id")
    .eq("data_room_id", roomId);

  if (visitorError) {
    console.error("Error fetching room visitors:", visitorError);
    return [];
  }

  const visitorIds = Array.from(new Set(roomVisitors?.map(v => v.visitor_id) || []));
  if (visitorIds.length === 0) return [];

  // 2. Get all deck IDs in this room to broaden the search for these visitors
  const { data: roomDocs, error: docsError } = await supabase
    .from("data_room_documents")
    .select("deck_id")
    .eq("data_room_id", roomId);

  if (docsError) {
    console.error("Error fetching room documents:", docsError);
    return [];
  }

  const deckIds = roomDocs?.map(d => d.deck_id).filter((id): id is string => !!id) || [];
  if (deckIds.length === 0) return [];

  // 3. Query page views for these visitors and these decks in safe-sized chunks
  // PostgREST .in() embeds values in the URL; chunk to avoid URL length limits
  const CHUNK_SIZE = 200;
  const allPageViewRows: {
    visitor_id: string;
    page_number: number;
    viewed_at: string;
    time_spent: number;
    viewer_email: string | null;
    deck_id: string;
    data_room_id: string | null;
  }[] = [];

  for (let vi = 0; vi < visitorIds.length; vi += CHUNK_SIZE) {
    const visitorChunk = visitorIds.slice(vi, vi + CHUNK_SIZE);
    for (let di = 0; di < deckIds.length; di += CHUNK_SIZE) {
      const deckChunk = deckIds.slice(di, di + CHUNK_SIZE);
      const { data: chunkData, error: chunkError } = await supabase
        .from("deck_page_views")
        .select(
          "visitor_id, page_number, viewed_at, time_spent, viewer_email, deck_id, data_room_id",
        )
        .in("visitor_id", visitorChunk)
        .in("deck_id", deckChunk)
        .or(`data_room_id.eq.${roomId},data_room_id.is.null`) // Scope to this room; null = legacy pre-room rows
        .order("viewed_at", { ascending: true });

      if (chunkError) {
        console.error("Error fetching room page views for signals (chunk):", chunkError);
        return [];
      }
      if (chunkData) allPageViewRows.push(...chunkData);
    }
  }

  const data = allPageViewRows;


  if (!data || data.length === 0) return [];

  // Group rows by visitor_id
  const byVisitor = new Map<string, PageViewRow[]>();
  for (const row of data as PageViewRow[]) {
    const existing = byVisitor.get(row.visitor_id) || [];
    existing.push(row);
    byVisitor.set(row.visitor_id, existing);
  }

  const results: VisitorSignal[] = [];

  for (const [visitorId, rows] of byVisitor) {
    const signals: SignalLabel[] = [];

    // Find the email (take the first non-null email for this visitor)
    const viewerEmail = rows.find((r) => r.viewer_email)?.viewer_email || null;

    // Distinct calendar days this visitor viewed the room
    const uniqueDays = new Set(
      rows.map((r) => new Date(r.viewed_at).toDateString()),
    );
    const distinctDays = uniqueDays.size;

    // Total rows = total slide views
    const totalVisits = rows.length;

    // Total time across all slides
    const totalTime = rows.reduce((sum, r) => sum + (r.time_spent || 0), 0);

    // Deep reads (slides where visitor spent >= 20 seconds) - count unique (deck_id, page_number) combinations
    const deepSlides = new Set(
      rows
        .filter((r) => r.deck_id != null && (r.time_spent || 0) >= 20)
        .map((r) => `${r.deck_id}_${r.page_number}`),
    ).size;

    // Days between first and last visit
    const dates = rows
      .map((r) => new Date(r.viewed_at).getTime())
      .sort((a, b) => a - b);
    const daysBetween = dates.length >= 2
      ? Math.round(
        (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24),
      )
      : null;

    // --- Apply signal rules ---
    if (distinctDays >= 2) signals.push("Revisited");
    if (totalVisits >= 3) signals.push("Viewed multiple times");
    if (deepSlides >= 2) signals.push("Spent time on key slides");
    if (daysBetween !== null && daysBetween <= 3 && distinctDays >= 2) {
      signals.push("Returned quickly");
    }
    if (totalTime >= 60) signals.push("Extended viewing");

    // We don't need slide breakdown for Room level analytics UI usually, so we can mock it or leave it empty, but we'll populate it with unique instances
    const deckMap = new Map<string, { totalVisits: number; totalTime: number }>();
    for (const row of rows) {
      if (!row.deck_id) continue;
      const current = deckMap.get(row.deck_id) || {
        totalVisits: 0,
        totalTime: 0,
      };
      current.totalVisits += 1;
      current.totalTime += row.time_spent || 0;
      deckMap.set(row.deck_id, current);
    }

    const deckBreakdown: DeckVisitSummary[] = Array.from(deckMap.entries())
      .map(([deckId, summary]) => ({
        deckId,
        totalVisits: summary.totalVisits,
        totalTime: Math.round(summary.totalTime),
      }))
      .sort((a, b) => b.totalVisits - a.totalVisits || b.totalTime - a.totalTime);

    results.push({
      visitorId,
      viewerEmail,
      totalVisits,
      totalTime: Math.round(totalTime),
      distinctDays,
      deepSlides,
      daysBetweenFirstAndLast: daysBetween,
      signals,
      slideBreakdown: [],
      deckBreakdown,
      isEngaged: signals.length > 0,
    });
  }

  // Sort: visitors with more signals first, then by total time
  results.sort((a, b) =>
    b.signals.length - a.signals.length || b.totalTime - a.totalTime
  );

  return results;
}
