/// <reference types="vitest/globals" />

import { TIER_CONFIG } from "../constants/tiers";
import {
  AI_SUMMARY_QUOTA_WINDOW_HOURS,
  evaluateAiSummaryQuota,
  evaluateGuestAiSummaryQuota,
  evaluateSignedInAiSummaryQuota,
  getGuestAiSummaryUsageCount,
  recordGuestAiSummaryUsage,
} from "./aiSummaryQuotaService";
import { deriveGuestQuotaKey } from "./aiGuestUsageIdentity";

const originalProjectSecretKey = process.env.PROJECT_SECRET_KEY;
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const mocks = vi.hoisted(() => {
  type MockResponse = {
    data?: unknown;
    error?: unknown;
    count?: number;
  };

  type TableChain = {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    lte: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    then: PromiseLike<MockResponse>["then"];
  };

  const responseQueues = new Map<string, MockResponse[]>();

  const queueResponse = (
    key: string,
    response: MockResponse | MockResponse[],
  ) => {
    responseQueues.set(key, Array.isArray(response) ? [...response] : [response]);
  };

  const consumeResponse = (key: string): MockResponse => {
    const queue = responseQueues.get(key) || [];
    const response = queue.shift() || { data: null, error: null };
    responseQueues.set(key, queue);
    return response;
  };

  const createTableChain = (table: string) => {
    let mode = "select";
    const chain = {
      select: vi.fn(() => {
        mode = "select";
        return chain;
      }),
      insert: vi.fn(() => {
        mode = "insert";
        return chain;
      }),
      update: vi.fn(() => {
        mode = "update";
        return chain;
      }),
      delete: vi.fn(() => {
        mode = "delete";
        return chain;
      }),
      eq: vi.fn(() => chain),
      gte: vi.fn(() => chain),
      lte: vi.fn(() => chain),
      order: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => consumeResponse(`${table}.${mode}.maybeSingle`)),
      single: vi.fn(async () => consumeResponse(`${table}.${mode}.single`)),
      then: ((resolve, reject) =>
        Promise.resolve(consumeResponse(`${table}.${mode}`)).then(
          resolve,
          reject,
        )) as TableChain["then"],
    } as TableChain;

    return chain;
  };

  const mockSupabase = {
    from: vi.fn((table: string) => createTableChain(table)),
  };

  return {
    responseQueues,
    queueResponse,
    mockSupabase,
  };
});

vi.mock("./supabase", () => ({
  supabase: mocks.mockSupabase,
}));

describe("aiSummaryQuotaService", () => {
  beforeEach(() => {
    mocks.responseQueues.clear();
    vi.clearAllMocks();
    process.env.PROJECT_SECRET_KEY = "test-guest-quota-secret";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterAll(() => {
    if (originalProjectSecretKey === undefined) {
      delete process.env.PROJECT_SECRET_KEY;
    } else {
      process.env.PROJECT_SECRET_KEY = originalProjectSecretKey;
    }

    if (originalServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    }
  });

  it("keeps canonical AI summary limits on the tier config", () => {
    expect(TIER_CONFIG.FREE.aiSummariesPerDay).toBe(2);
    expect(TIER_CONFIG.PRO.aiSummariesPerDay).toBe(10);
    expect(TIER_CONFIG.PRO_PLUS.aiSummariesPerDay).toBe(50);
  });

  it("enforces signed-in quota limits and upgrade hints", () => {
    const freeAllowed = evaluateSignedInAiSummaryQuota("FREE", 1);
    const freeDenied = evaluateSignedInAiSummaryQuota("FREE", 2);
    const proAllowed = evaluateSignedInAiSummaryQuota("PRO", 9);
    const proDenied = evaluateSignedInAiSummaryQuota("PRO", 10);
    const proPlusDenied = evaluateSignedInAiSummaryQuota("PRO_PLUS", 50);

    expect(freeAllowed).toMatchObject({
      allowed: true,
      chargeable: true,
      reason: "allowed",
      limitPer24Hours: 2,
      remaining: 1,
      tier: "FREE",
    });

    expect(freeDenied).toMatchObject({
      allowed: false,
      chargeable: false,
      reason: "signed_in_limit_reached",
      nextAction: "upgrade",
      limitPer24Hours: 2,
      remaining: 0,
      tier: "FREE",
    });

    expect(proAllowed).toMatchObject({
      allowed: true,
      chargeable: true,
      reason: "allowed",
      limitPer24Hours: 10,
      remaining: 1,
      tier: "PRO",
    });

    expect(proDenied).toMatchObject({
      allowed: false,
      chargeable: false,
      reason: "signed_in_limit_reached",
      nextAction: "upgrade",
      limitPer24Hours: 10,
      remaining: 0,
      tier: "PRO",
    });

    expect(proPlusDenied).toMatchObject({
      allowed: false,
      chargeable: false,
      reason: "signed_in_limit_reached",
      nextAction: "none",
      limitPer24Hours: 50,
      remaining: 0,
      tier: "PRO_PLUS",
    });
  });

  it("treats cached reopen as no-charge for signed-in and guest users", () => {
    const signedInCached = evaluateAiSummaryQuota({
      scope: "signed_in",
      tier: "FREE",
      usageCount: 99,
      cachedReopen: true,
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    const guestCached = evaluateGuestAiSummaryQuota(1, {
      cachedReopen: true,
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    expect(signedInCached).toMatchObject({
      allowed: true,
      chargeable: false,
      reason: "cached_reopen",
      nextAction: "none",
    });

    expect(guestCached).toMatchObject({
      allowed: true,
      chargeable: false,
      reason: "cached_reopen",
      nextAction: "none",
    });
  });

  it("blocks guests after one summary in the 24-hour window", () => {
    const allowed = evaluateGuestAiSummaryQuota(0, {
      now: new Date("2026-05-02T12:00:00.000Z"),
    });
    const denied = evaluateGuestAiSummaryQuota(1, {
      now: new Date("2026-05-02T12:00:00.000Z"),
    });

    expect(allowed).toMatchObject({
      allowed: true,
      chargeable: true,
      reason: "allowed",
      limitPer24Hours: 1,
      remaining: 1,
      nextAction: "none",
    });

    expect(denied).toMatchObject({
      allowed: false,
      chargeable: false,
      reason: "guest_limit_reached",
      nextAction: "auth",
      limitPer24Hours: 1,
      remaining: 0,
    });
  });

  it("counts guest usage within the 24-hour window and records usage rows", async () => {
    mocks.queueResponse("ai_guest_usage.select", {
      data: null,
      error: null,
      count: 1,
    });
    mocks.queueResponse("ai_guest_usage.insert", {
      data: null,
      error: null,
    });

    const now = new Date("2026-05-02T12:00:00.000Z");
    const count = await getGuestAiSummaryUsageCount("203.0.113.10", now);

    expect(count).toBe(1);
    expect(mocks.mockSupabase.from).toHaveBeenCalledWith("ai_guest_usage");

    const tableChain = mocks.mockSupabase.from.mock.results[0]?.value as {
      eq: ReturnType<typeof vi.fn>;
      gte: ReturnType<typeof vi.fn>;
      lte: ReturnType<typeof vi.fn>;
    };

    expect(tableChain.eq).toHaveBeenCalledWith(
      "ip_hash",
      await deriveGuestQuotaKey("203.0.113.10", "test-guest-quota-secret"),
    );
    expect(tableChain.gte).toHaveBeenCalledWith(
      "consumed_at",
      new Date(now.getTime() - AI_SUMMARY_QUOTA_WINDOW_HOURS * 60 * 60 * 1000).toISOString(),
    );
    expect(tableChain.lte).toHaveBeenCalledWith("consumed_at", now.toISOString());

    await recordGuestAiSummaryUsage({
      ipAddress: "203.0.113.10",
      scopeType: "deck",
      scopeId: "deck-1",
      contentHash: "hash-1",
      modelIdentifier: "gpt-4o-mini",
      modelVersion: "v1",
      consumedAt: now,
    });

    expect(mocks.mockSupabase.from).toHaveBeenCalledWith("ai_guest_usage");

    const insertChain = mocks.mockSupabase.from.mock.results[1]?.value as {
      insert: ReturnType<typeof vi.fn>;
    };

    expect(insertChain.insert).toHaveBeenCalledWith({
      ip_hash: await deriveGuestQuotaKey("203.0.113.10", "test-guest-quota-secret"),
      usage_date: "2026-05-02",
      scope_type: "deck",
      scope_id: "deck-1",
      content_hash: "hash-1",
      model_identifier: "gpt-4o-mini",
      model_version: "v1",
      usage_kind: "summary",
      consumed_at: now.toISOString(),
      retention_expires_at: new Date("2026-07-31T12:00:00.000Z").toISOString(),
    });
  });
});
