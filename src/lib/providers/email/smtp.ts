import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./types";

export class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  private transporter: Transporter | null = null;

  isAvailable(): boolean {
    return Boolean(env.SMTP_HOST);
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      if (!env.SMTP_HOST) {
        throw new Error("SMTP_HOST is not configured");
      }

      const isSecure =
        env.SMTP_SECURE === "true" ||
        env.SMTP_SECURE === "1" ||
        env.SMTP_PORT === 465;

      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: isSecure,
        ...(env.SMTP_USER && env.SMTP_PASS
          ? {
              auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
              },
            }
          : {}),
      });
    }
    return this.transporter;
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    if (!this.isAvailable()) {
      throw new Error(
        "SMTP email provider is unavailable (SMTP_HOST is not configured)",
      );
    }

    const transporter = this.getTransporter();
    const from = message.from || env.SMTP_FROM;

    try {
      const info = await transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });

      return {
        id: info.messageId || `smtp-${Date.now()}`,
        provider: "smtp",
      };
    } catch (error) {
      logger.error({ error, to: message.to }, "Failed to send email via SMTP");
      throw error;
    }
  }
}

export const smtpEmailProvider = new SmtpEmailProvider();
