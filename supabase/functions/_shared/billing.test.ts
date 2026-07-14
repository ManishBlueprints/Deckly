import {
  applyProviderSubscription,
  asProviderSubscription,
  hmacHex,
  planFor,
  timingSafeEqual,
} from "./billing.ts";

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

Deno.test("maps only eligible paid tiers and intervals to server-owned plan codes", () => {
  expect(planFor("PRO", "monthly")?.code === "SHARE_MONTHLY", "Share monthly should map to its plan code");
  expect(planFor("RAISE", "yearly")?.code === "RAISE_YEARLY", "Raise yearly should map to its plan code");
  expect(planFor("FREE", "monthly") === null, "Free must not create a provider subscription");
  expect(planFor("PRO", "quarterly") === null, "Unsupported billing intervals must be rejected");
});

Deno.test("validates a minimal provider subscription response", () => {
  const provider = asProviderSubscription({ id: "sub_test", status: "active" });
  expect(provider.id === "sub_test" && provider.status === "active", "Expected validated provider subscription");

  let rejected = false;
  try {
    asProviderSubscription({ id: "sub_test" });
  } catch {
    rejected = true;
  }
  expect(rejected, "A response without a provider status must be rejected");
});

Deno.test("compares Razorpay HMAC values without accepting a mismatched value", async () => {
  const signature = await hmacHex("test-secret", "pay_test|sub_test");
  const changedSignature = `${signature.slice(0, -1)}${signature.endsWith("0") ? "1" : "0"}`;
  expect(timingSafeEqual(signature, signature), "Expected equal HMACs to match");
  expect(!timingSafeEqual(signature, changedSignature), "Expected changed HMAC to fail");
});

Deno.test("rejects incomplete scheduled-plan updates before writing billing state", async () => {
  let rejected = false;
  try {
    await applyProviderSubscription({
      rpc: () => Promise.resolve({ error: null }),
    } as never, {
      id: "sub_test",
      status: "active",
    }, {
      fallbackPlanCode: "SHARE_MONTHLY",
      pendingPlanCode: "FOUNDER_MONTHLY",
      pendingChangeAt: null,
      preservePendingPlan: false,
    });
  } catch (error) {
    rejected = error instanceof Error && error.message.includes("scheduled plan");
  }
  expect(rejected, "A scheduled plan update must include both fields");
});
