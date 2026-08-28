import { z } from "zod";
import { infrai } from "./infrai.js";

const notificationBatchSchema = z.object({
  event_id: z.string().uuid(),
  tenant_id: z.string(),
  account_id: z.string(),
  template: z.enum(["tenant-welcome", "account-ready", "admin-access-changed"]),
  subscriber_ids: z.array(z.string()),
});

export async function deliverQueuedNotifications(): Promise<number> {
  const messages = await infrai.queue.consume(20, 60);
  for (const message of messages) {
    const batch = notificationBatchSchema.parse(message.payload);
    for (const subscriberId of batch.subscriber_ids) {
      console.log("deliver", {
        subscriber_id: subscriberId,
        tenant_id: batch.tenant_id,
        template: batch.template,
      });
    }
    await infrai.queue.ack(message.message_id);
  }
  return messages.length;
}

const processed = await deliverQueuedNotifications();
console.log(`Acknowledged ${processed} notification batches`);
