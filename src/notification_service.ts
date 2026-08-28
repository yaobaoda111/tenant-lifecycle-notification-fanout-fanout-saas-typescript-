import { createServer, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiError, infrai } from "./infrai.js";
import { lifecycleEventSchema, planNotification } from "./notification_policy.js";

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/lifecycle-events") {
    json(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const event = lifecycleEventSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const batch = planNotification(event);
    if (!batch) {
      json(response, 202, { state: "recorded_without_notification", event_id: event.event_id });
      return;
    }

    await infrai.queue.publish(batch, `lifecycle:${event.event_id}`);
    json(response, 202, {
      state: "queued",
      event_id: event.event_id,
      subscriber_count: batch.subscriber_ids.length,
    });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      json(response, 400, { error: "invalid_request" });
      return;
    }
    if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      json(response, error.status, { error: error.code, detail: error.message });
      return;
    }
    console.error(error);
    json(response, 500, { error: "request_failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Lifecycle intake listening on http://localhost:${port}`));
