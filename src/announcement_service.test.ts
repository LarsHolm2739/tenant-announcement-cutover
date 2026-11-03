import test from "node:test";
import assert from "node:assert/strict";
import { decideAnnouncement } from "./announcement_service.ts";

test("an onboarded tenant with members receives the announcement", () => {
  const decision = decideAnnouncement({
    tenantId: "acme",
    event: "billing.maintenance",
    data: { startsAt: "2026-11-01T00:00:00Z" },
    accountId: "account-acme"
  }, 12);
  assert.equal(decision, "publish");
});

test("an empty tenant is skipped", () => {
  const decision = decideAnnouncement({ tenantId: "acme", event: "billing.maintenance", data: {}, accountId: "account-acme" }, 0);
  assert.equal(decision, "skip");
});
