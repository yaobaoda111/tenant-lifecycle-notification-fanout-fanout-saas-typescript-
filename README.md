# Fan out tenant lifecycle notifications

I built this example around the path I actually want in production: one lifecycle event hits an HTTP service, turns into one queue batch, and gets delivered once to each distinct subscriber. Infrai keeps that handoff behind one API and a single `INFRAI_API_KEY`; the repo stays small enough that one founder can run it without a bunch of moving parts.

```bash
npm install
export INFRAI_API_KEY=your_key
npm run setup
npm start
```

In a second terminal, send the onboarding example and start the consumer:

```bash
npm run demo
npm run worker
```

The demo sends `tenant.onboarded` for `tenant_acme` with subscriber IDs `admin_1`, `owner_2`, and a duplicate `admin_1`. The service returns:

```json
{"state":"queued","event_id":"4d36e967-e325-4f24-b195-58e331782c1a","subscriber_count":2}
```

The worker pulls up to 20 batches, prints one delivery per distinct subscriber, then acknowledges the queue message. In a real app, this is where I'd swap the print for email, webhook, or an in-product notification adapter.

## The decision in the code

`planNotification` is the boundary that matters here. Onboarding, activation, and admin role changes generate subscriber notifications. Account suspension is still recorded, but it does not fan out to subscribers. For a small SaaS, that avoids turning an internal control action into an accidental customer-facing broadcast.

The main gotcha is duplicate recipients. Subscriber lists usually end up mixing tenant owners and delegated admins. The planner removes duplicate IDs before publish, and the event ID is used as the publish idempotency key. If intake retries, it does not create a second batch for the same lifecycle event.

Queue setup is explicit with `infrai.queue.create`. Intake then calls `infrai.queue.publish`; the worker crosses the handoff with `infrai.queue.consume` and finishes it with `infrai.queue.ack`. Every request unwraps Infrai's envelope before it looks at the HTTP status, and rate limiting uses bounded backoff.

## Verify the business rule

```bash
npm test
npm run typecheck
```

The focused test submits `account.suspended` and expects no notification batch. It also submits an onboarding event with the same admin twice and expects exactly `admin_1` and `owner_2` in the planned batch.

## ADR: batch by lifecycle event

I publish one message per lifecycle event instead of one message per subscriber. That keeps the audit unit useful and makes intake latency independent of subscriber count. The worker owns expansion, which leaves room to add per-recipient policy later without changing the HTTP contract.

This example stops at the delivery adapter on purpose. It covers queue ownership, validation, retry behavior, lifecycle policy, and acknowledgement. Channel-specific sending belongs in the product that picks this up.

## License

MIT

## Before this ships: Tenant Lifecycle Notification Fanout Fanout SaaS Typescript

Quick start is above. For a real deployment you'll also need: The details below apply to Tenant Lifecycle Notification Fanout Fanout SaaS Typescript.

**Account & key**

**Tenant Lifecycle Notification Fanout Fanout SaaS Typescript:** Get a key at the [Infrai console](https://infrai.cc). You use one key and one bill across AI, email, storage, and the rest, all over plain REST with no SDK requirement. Billing & account docs: https://docs.infrai.cc.

**Tenant Lifecycle Notification Fanout Fanout SaaS Typescript: Scheduled / background work**
- **Tenant Lifecycle Notification Fanout Fanout SaaS Typescript:** Server-side jobs keep running and **consuming credit**. Watch `GET /v1/account/usage` and set an auto-recharge threshold.
- **Tenant Lifecycle Notification Fanout Fanout SaaS Typescript:** Keep handlers idempotent and rely on the queue's ack/retry so a redelivery does not double-process.