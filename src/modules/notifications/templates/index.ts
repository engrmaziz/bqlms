import { render } from "@react-email/render";
import * as React from "react";
import { type DigestEmailProps, DigestEmailTemplate } from "./digest";
import { type ImmediateEmailProps, ImmediateEmailTemplate } from "./immediate";

export * from "./digest";
export * from "./immediate";

export async function renderImmediateEmail(
  props: ImmediateEmailProps,
): Promise<{ html: string; text?: string }> {
  const html = await render(React.createElement(ImmediateEmailTemplate, props));
  const text = await render(
    React.createElement(ImmediateEmailTemplate, props),
    { plainText: true },
  );
  return { html, text };
}

export async function renderDigestEmail(
  props: DigestEmailProps,
): Promise<{ html: string; text?: string }> {
  const html = await render(React.createElement(DigestEmailTemplate, props));
  const text = await render(React.createElement(DigestEmailTemplate, props), {
    plainText: true,
  });
  return { html, text };
}
