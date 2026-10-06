import { type NextRequest, NextResponse } from "next/server";
import { withTx } from "@/db/tx";
import { getWebhookHandler, recordWebhookEvent } from "@/modules/webhooks";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await context.params;
  const handler = getWebhookHandler(provider);

  if (!handler) {
    return NextResponse.json(
      { error: `Webhook provider not supported: ${provider}` },
      { status: 404 },
    );
  }

  const rawBody = await req.text();
  const isValid = await handler.verify(rawBody, req.headers);

  if (!isValid) {
    return NextResponse.json(
      { error: "Webhook signature verification failed" },
      { status: 401 },
    );
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = rawBody.trim().length > 0 ? JSON.parse(rawBody) : {};
  } catch {
    parsedPayload = { raw: rawBody };
  }

  const externalId = handler.extractExternalId(parsedPayload, req.headers);

  const result = await withTx(async (tx) => {
    return recordWebhookEvent(tx, provider, externalId, parsedPayload);
  });

  if (result.duplicate) {
    return NextResponse.json(
      {
        status: "ok",
        duplicate: true,
        message: "Duplicate event acknowledged",
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    { status: "ok", eventId: result.event?.id },
    { status: 200 },
  );
}
