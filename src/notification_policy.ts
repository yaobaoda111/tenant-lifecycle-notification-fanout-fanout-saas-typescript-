import { z } from "zod";

export const lifecycleEventSchema = z.object({
  event_id: z.string().uuid(),
  tenant_id: z.string().min(1),
  account_id: z.string().min(1),
  kind: z.enum(["tenant.onboarded", "account.activated", "account.suspended", "admin.role_changed"]),
  subscriber_ids: z.array(z.string().min(1)).min(1).max(1_000),
});

export type LifecycleEvent = z.infer<typeof lifecycleEventSchema>;

export type NotificationBatch = {
  event_id: string;
  tenant_id: string;
  account_id: string;
  template: "tenant-welcome" | "account-ready" | "admin-access-changed";
  subscriber_ids: string[];
};

export function planNotification(event: LifecycleEvent): NotificationBatch | null {
  const template = {
    "tenant.onboarded": "tenant-welcome",
    "account.activated": "account-ready",
    "admin.role_changed": "admin-access-changed",
  } as const;

  if (event.kind === "account.suspended") return null;
  return {
    event_id: event.event_id,
    tenant_id: event.tenant_id,
    account_id: event.account_id,
    template: template[event.kind],
    subscriber_ids: [...new Set(event.subscriber_ids)],
  };
}
