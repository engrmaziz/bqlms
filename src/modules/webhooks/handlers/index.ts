import crypto from "node:crypto";
import type { Tx } from "@/db/tx";
import type { WebhookEvent } from "../schema";

export interface WebhookHandler {
  readonly name: string;
  verify(rawBody: string, headers: Headers): boolean | Promise<boolean>;
  extractExternalId(payload: unknown, headers: Headers): string;
  process(event: WebhookEvent, tx: Tx): Promise<void>;
}

const handlers = new Map<string, WebhookHandler>();

export function registerWebhookHandler(handler: WebhookHandler): void {
  handlers.set(handler.name.toLowerCase(), handler);
}

export function getWebhookHandler(
  provider: string,
): WebhookHandler | undefined {
  return handlers.get(provider.toLowerCase());
}

export function timingSafeEqualString(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a).digest();
  const hashB = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

// Built-in test webhook handler for testing and verification
export const testWebhookHandler: WebhookHandler = {
  name: "test",
  verify: (rawBody: string, headers: Headers) => {
    const signature = headers.get("x-webhook-signature");
    if (!signature) return false;
    const expected = crypto
      .createHmac("sha256", "test-webhook-secret")
      .update(rawBody)
      .digest("hex");
    return timingSafeEqualString(signature, expected);
  },
  extractExternalId: (payload: unknown, headers: Headers) => {
    const fromHeader = headers.get("x-event-id");
    if (fromHeader) return fromHeader;
    if (
      payload &&
      typeof payload === "object" &&
      "id" in payload &&
      typeof payload.id === "string"
    ) {
      return payload.id;
    }
    return `evt_${Date.now()}`;
  },
  process: async (_event: WebhookEvent, _tx: Tx) => {
    // Processed test webhook event
  },
};

registerWebhookHandler(testWebhookHandler);
