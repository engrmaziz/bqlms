export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string | undefined;
  from?: string | undefined;
}

export interface EmailSendResult {
  id: string;
  provider: "smtp" | "fake";
}

export interface EmailProvider {
  readonly name: string;
  isAvailable(): boolean;
  send(message: EmailMessage): Promise<EmailSendResult>;
}
