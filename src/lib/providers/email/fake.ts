import { uuidv7 } from "uuidv7";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

export class FakeEmailProvider implements EmailProvider {
  readonly name = "fake";
  public sentEmails: EmailMessage[] = [];
  public available = true;

  isAvailable(): boolean {
    return this.available;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.available) {
      throw new Error("Email service is currently unavailable");
    }
    this.sentEmails.push({ ...message });
    return {
      id: `fake-${uuidv7()}`,
      provider: "fake",
    };
  }

  clear(): void {
    this.sentEmails = [];
  }
}

export const fakeEmailProvider = new FakeEmailProvider();
