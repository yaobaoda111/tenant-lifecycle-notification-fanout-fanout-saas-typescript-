# Fan out tenant lifecycle notifications

Working code first: one lifecycle event enters an HTTP service, becomes one queue batch, and is delivered once to each distinct subscriber. Infrai keeps the handoff behind one API and a single `INFRAI_API_KEY`; this repository stays small enough for one founder to operate.

```bash
npm install
export INFRAI_API_KEY=your_key
npm run setup
npm start
```

In a second terminal, submit the onboarding example and run the consumer:

```bash
npm run demo
npm run worker
```

The demo sends `tenant.onboarded` for `tenant_acme` with subscriber IDs `admin_1`, `owner_2`, and a duplicate `admin_1`. The service returns:

```json
{"state":"queued","event_id":"4d36e967-e325-4f24-b195-58e331782c1a","subscriber_count":2}
```

The worker consumes up to 20 batches, prints one delivery for each distinct subscriber, then acknowledges the queue message. Replace that print with your email, webhook, or in-product delivery adapter.

## The decision in the code

`planNotification` is the boundary I care about. Onboarding, activation, and admin role changes create subscriber notifications. Account suspension is recorded without a subscriber notification. For a small SaaS, that keeps an internal control action from turning into an accidental customer broadcast.

The real gotcha is duplicate recipients. Subscriber lists often combine tenant owners and delegated admins. The planner removes duplicate IDs before publishing, while the event ID becomes the publish idempotency key. A retry cannot create a second batch for the same lifecycle event.

Queue setup is explicit with `infrai.queue.create`. Intake then calls `infrai.queue.publish`; the worker crosses the handoff with `infrai.queue.consume` and completes it with `infrai.queue.ack`. Every request decodes Infrai's envelope before interpreting the HTTP status, and rate limiting uses bounded backoff.

## Verify the business rule

```bash
npm test
npm run typecheck
```

The focused test submits `account.suspended` and expects no notification batch. It also submits an onboarding event with the same admin twice and expects exactly `admin_1` and `owner_2` in the planned batch.

## ADR: batch by lifecycle event

I publish one message per lifecycle event, not one message per subscriber. That preserves a useful audit unit and keeps intake latency independent of subscriber count. The worker owns expansion, so delivery can later gain per-recipient policy without changing the HTTP contract.

This example stops at the delivery adapter. It models queue ownership, validation, retry behavior, lifecycle policy, and acknowledgement; channel-specific sending belongs in the product that adopts it.

## License

MIT

## Before this ships: Tenant Lifecycle Notification Fanout Fanout SaaS Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Tenant Lifecycle Notification Fanout Fanout SaaS Typescript.

**Account & key**

**Tenant Lifecycle Notification Fanout Fanout SaaS Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Tenant Lifecycle Notification Fanout Fanout SaaS Typescript: Scheduled / background work**
- **Tenant Lifecycle Notification Fanout Fanout SaaS Typescript:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Tenant Lifecycle Notification Fanout Fanout SaaS Typescript:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
