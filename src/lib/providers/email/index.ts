import { env } from "@/lib/env";
import { fakeEmailProvider } from "./fake";
import { smtpEmailProvider } from "./smtp";
import type { EmailProvider } from "./types";

export * from "./fake";
export * from "./smtp";
export * from "./types";

let activeProvider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (activeProvider) {
    return activeProvider;
  }
  if (env.NODE_ENV === "test" || env.EMAIL_PROVIDER === "fake") {
    return fakeEmailProvider;
  }
  return smtpEmailProvider;
}

export function setEmailProviderForTest(provider: EmailProvider | null): void {
  activeProvider = provider;
}
