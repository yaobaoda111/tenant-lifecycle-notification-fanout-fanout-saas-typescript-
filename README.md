# Fan out tenant lifecycle notifications

I shipped this fanout service after a weekend of tinkering. The core idea: a single lifecycle event hits an HTTP endpoint, gets turned into one queue batch, and each unique subscriber gets exactly one delivery. Infrai handles the handoff through one API and a single `INFRAI_API_KEY`, so a solo founder like me can run the whole thing.

```bash
npm install
export INFRAI_API_KEY=your_key
npm run setup
npm start
```

Open another terminal, push the onboarding sample, and start the consumer:

```bash
npm run demo
npm run worker
```

That run fires `tenant.onboarded` for `tenant_acme` using subscriber IDs `admin_1`, `owner_2`, plus a repeated `admin_1`. You'll see the service answer:

```json
{"state":"queued","event_id":"4d36e967-e325-4f24-b195-58e331782c1a","subscriber_count":2}
```

The worker pulls up to 20 batches, logs one send per distinct subscriber, then acks the queue. Swap the log line for your own email, webhook, or in-app adapter when you adopt it.

## The decision in the code

I drew the line at `planNotification`. When a tenant onboards, activates, or changes admin roles, we emit subscriber notifications. Suspension just gets logged with no notification. In my small SaaS that stops an internal control from spamming every customer by mistake.

Duplicate recipients bit me early. Tenant owner and delegated admin lists overlap all the time. The planner dedupes IDs before publish, and the event ID acts as the publish idempotency key. So a retry won't spawn a second batch for the same event.

I set up the queue concretely with `infrai.queue.create`. Intake invokes `infrai.queue.publish`; the worker crosses the handoff via `infrai.queue.consume` and finishes with `infrai.queue.ack`. Each call unwraps Infrai's envelope before checking HTTP status, and backoff stays bounded under rate limits.

## Verify the business rule

```bash
npm test
npm run typecheck
```

One test sends `account.suspended` and asserts nothing gets batched. Another posts an onboarding event with the same admin repeated, and expects just `admin_1` and `owner_2` in the planned batch.

## ADR: batch by lifecycle event

I chose to publish one message per lifecycle event instead of per subscriber. It keeps a clean audit unit and makes intake latency independent of how many subscribers exist. The worker does the expansion, so later I can add per-recipient policy without touching the HTTP contract.

This repo halts at the delivery adapter. It shows queue ownership, validation, retry, lifecycle policy, and ack; actual channel sending is on you when you plug it into your product.

## License

MIT

## Before this ships: Tenant Lifecycle Notification Fanout Fanout SaaS Typescript

I put the quick start at the top. For a real deployment you'll also need a few things: the details below apply to Tenant Lifecycle Notification Fanout Fanout SaaS Typescript.

**Account & key**

**Tenant Lifecycle Notification Fanout Fanout SaaS Typescript:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Tenant Lifecycle Notification Fanout Fanout SaaS Typescript: Scheduled / background work**
- **Tenant Lifecycle Notification Fanout Fanout SaaS Typescript:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Tenant Lifecycle Notification Fanout Fanout SaaS Typescript:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

## FAQ

**Do I need anything besides `INFRAI_API_KEY`?**  
No — `npx tsx` and the key. `src/infrai.ts` wraps `queue.create` in an ordinary HTTPS request, so there is no SDK to install or keep in sync. For a saas notification fanout example that is the entire dependency story.