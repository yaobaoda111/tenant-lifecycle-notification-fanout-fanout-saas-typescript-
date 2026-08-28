import assert from "node:assert/strict";
import test from "node:test";
import { lifecycleEventSchema, planNotification } from "../src/notification_policy.js";

test("a suspended account is recorded without notifying subscribers", () => {
  const event = lifecycleEventSchema.parse({
    event_id: "d85b1407-351d-4694-9270-04fa4682fca4",
    tenant_id: "tenant_acme",
    account_id: "account_42",
    kind: "account.suspended",
    subscriber_ids: ["owner_1", "admin_2"],
  });

  assert.equal(planNotification(event), null);
});

test("onboarding fans out once per distinct subscriber", () => {
  const event = lifecycleEventSchema.parse({
    event_id: "4d36e967-e325-4f24-b195-58e331782c1a",
    tenant_id: "tenant_acme",
    account_id: "account_42",
    kind: "tenant.onboarded",
    subscriber_ids: ["admin_1", "owner_2", "admin_1"],
  });

  assert.deepEqual(planNotification(event)?.subscriber_ids, ["admin_1", "owner_2"]);
});
