export {};

const event = {
  event_id: "4d36e967-e325-4f24-b195-58e331782c1a",
  tenant_id: "tenant_acme",
  account_id: "account_42",
  kind: "tenant.onboarded",
  subscriber_ids: ["admin_1", "owner_2", "admin_1"],
};

const response = await fetch("http://localhost:3000/lifecycle-events", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(event),
});
console.log(await response.json());
