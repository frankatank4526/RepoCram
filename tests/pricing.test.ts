import assert from "node:assert/strict";
import test from "node:test";
import {
  canRunScan,
  getOneTimeTier,
  getSubscriptionPlan,
} from "../app/lib/pricing.ts";

function getPlan(id: "free" | "starter" | "pro" | "team") {
  const plan = getSubscriptionPlan(id);

  assert.ok(plan, `Expected ${id} plan to exist`);
  return plan;
}

test("one-time scan tiers keep the expected prices", () => {
  assert.deepEqual(getOneTimeTier(40, 60_000), {
    suggestedTier: "small",
    suggestedPrice: 5,
  });
  assert.deepEqual(getOneTimeTier(160, 240_000), {
    suggestedTier: "medium",
    suggestedPrice: 12,
  });
  assert.deepEqual(getOneTimeTier(161, 240_001), {
    suggestedTier: "deep",
    suggestedPrice: 25,
  });
});

test("Free plan allows at most three small scans per month", () => {
  const free = getPlan("free");

  assert.deepEqual(canRunScan(free, { scansUsed: 0 }, "small"), {
    allowed: true,
  });
  assert.deepEqual(canRunScan(free, { scansUsed: 2 }, "small"), {
    allowed: true,
  });
  assert.deepEqual(canRunScan(free, { scansUsed: 3 }, "small"), {
    allowed: false,
    reason: "Free allows 3 scans/month.",
  });
});

test("Free plan only allows small scans and excludes mock PRs", () => {
  const free = getPlan("free");

  assert.deepEqual(canRunScan(free, { scansUsed: 0 }, "medium"), {
    allowed: false,
    reason: "Free plan only supports small scans.",
  });
  assert.deepEqual(canRunScan(free, { scansUsed: 0 }, "deep"), {
    allowed: false,
    reason: "Free plan only supports small scans.",
  });
  assert.equal(free.limits.mockPrs, false);
});

test("paid plan scan tier limits are enforced", () => {
  const starter = getPlan("starter");
  const pro = getPlan("pro");
  const team = getPlan("team");

  assert.deepEqual(canRunScan(starter, { scansUsed: 0 }, "deep"), {
    allowed: false,
    reason: "Starter does not include deep scans.",
  });
  assert.deepEqual(canRunScan(pro, { scansUsed: 0 }, "deep"), {
    allowed: true,
  });
  assert.deepEqual(canRunScan(team, { scansUsed: 0 }, "deep"), {
    allowed: true,
  });
});
