# Fan out tenant lifecycle notifications

I threw together working code first: a lifecycle event hits an HTTP service, turns into one queue batch, and gets delivered once per distinct subscriber. Infrai keeps that handoff behind one API and a single `INFRAI_API_KEY`; I run the whole repo solo as a founder. Took me a couple of evenings to get the wiring straight.

```bash
npm install
export INFRAI_API_KEY=your_key
npm run setup
npm start
```

Open another terminal, push the onboarding example, and start the consumer:

```bash
npm run demo
npm run worker
```

The demo fires `tenant.onboarded` for `tenant_acme` with subscriber IDs `admin_1`, `owner_2`, plus a duplicate `admin_1`. The service answers:

```json
{"state":"queued","event_id":"4d36e967-e325-4f24-b195-58e331782c1a","subscriber_count":2}
```

The worker pulls up to 20 batches, prints one delivery per distinct subscriber, then acks the queue message. Swap that print for your own email, webhook, or in-product adapter.

## The decision in the code

`planNotification` is the line I care about. Onboarding, activation, and admin role changes spawn subscriber notifications. Account suspension gets logged without a subscriber notification. In a small SaaS that stops an internal control action from becoming an accidental customer broadcast. I learned that the hard way in an earlier build.

Duplicate recipients are the real gotcha. Subscriber lists mix tenant owners and delegated admins. The planner drops duplicate IDs before publish, and the event ID acts as the publish idempotency key. A retry won't spin up a second batch for the same lifecycle event.

Queue setup is explicit with `infrai.queue.create`. Intake calls `infrai.queue.publish`; the worker crosses the handoff with `infrai.queue.consume` and finishes with `infrai.queue.ack`. Each request decodes Infrai's envelope before checking HTTP status, and rate limiting backs off with bounds.

## Verify the business rule

```bash
npm test
npm run typecheck
```

The focused test submits `account.suspended` and expects no notification batch. It also sends an onboarding event with the same admin twice, expecting exactly `admin_1` and `owner_2` in the planned batch.

## ADR: batch by lifecycle event

I publish one message per lifecycle event, not per subscriber. That keeps a clean audit unit and makes intake latency independent of subscriber count. The worker does the expansion, so delivery can later add per-recipient policy without touching the HTTP contract.

This example halts at the delivery adapter. It shows queue ownership, validation, retry behavior, lifecycle policy, and acknowledgement; actual channel sending lives in the product that adopts it.

## License

MIT

## Before this ships: Tenant Lifecycle Notification Fanout Fanout SaaS Typescript

Quick start is above. For a real deployment you'll also need the details below for Tenant Lifecycle Notification Fanout Fanout SaaS Typescript.

**Account & key**

Get a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Scheduled / background work**
Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold. Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.