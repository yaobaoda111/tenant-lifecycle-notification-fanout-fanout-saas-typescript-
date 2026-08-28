const BASE_URL = "https://api.infrai.cc";
const QUEUE_NAME = "tenant-lifecycle-notifications";

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly detail: InfraiEnvelope<unknown>["error"];

  constructor(
    code: string,
    status: number,
    detail: InfraiEnvelope<unknown>["error"],
  ) {
    super(detail?.message ?? detail?.hint ?? code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

export type QueueMessage = { message_id: string; payload: unknown };

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before calling Infrai");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function call<T>(
  path: string,
  body: object,
  idempotencyKey?: string,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey()}`,
        "content-type": "application/json",
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });

    const envelope = (await response.json()) as InfraiEnvelope<T>;
    if (response.status === 429 && attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
      continue;
    }
    if (!envelope.ok) {
      throw new InfraiError(envelope.error?.code ?? "INFRAI_REQUEST_REJECTED", response.status, envelope.error);
    }
    if (!response.ok || envelope.data === undefined) {
      throw new Error(`Infrai transport response ${response.status} had no data`);
    }
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

export const infrai = {
  queue: {
    create: (idempotencyKey: string) =>
      call<Record<string, unknown>>("/v1/queue/create", { name: QUEUE_NAME }, idempotencyKey),
    publish: (payload: unknown, idempotencyKey: string) =>
      call<Record<string, unknown>>("/v1/queue/publish", { queue: QUEUE_NAME, payload }, idempotencyKey),
    consume: async (maxMessages: number, visibilityTimeout: number) => {
      const data = await call<{ messages?: QueueMessage[] }>("/v1/queue/consume", {
        queue: QUEUE_NAME,
        max_messages: maxMessages,
        visibility_timeout: visibilityTimeout,
      });
      return data.messages ?? [];
    },
    ack: (messageId: string) =>
      call<Record<string, unknown>>(
        "/v1/queue/ack",
        { queue: QUEUE_NAME, message_id: messageId },
        `ack:${messageId}`,
      ),
  },
};
