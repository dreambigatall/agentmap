import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type Env } from '../../config/env';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** The one link the email is about. Shown in the log in development. */
  link?: string;
}

/**
 * Sends email through Resend. Without RESEND_API_KEY (development and tests) it prints
 * the message, including its link, to the API log instead, and keeps it in `outbox`.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  /** Messages handled in this process. Read by tests; not used in production code. */
  readonly outbox: MailMessage[] = [];

  constructor(@Inject(ENV) private readonly env: Env) {}

  async send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
    if (this.outbox.length > 200) this.outbox.shift();

    if (!this.env.RESEND_API_KEY) {
      this.logger.log(
        `Email to ${message.to}: "${message.subject}"${message.link ? `\n  Link: ${message.link}` : ''}`,
      );
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.env.MAIL_FROM,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
      });
      if (!response.ok) {
        // Resend explains refusals, e.g. "You can only send testing emails to your own
        // email address" until a sending domain is verified. Log that, plus the link,
        // so development can carry on.
        const body = (await response.json().catch(() => ({}))) as { message?: string };
        this.logger.error(
          `Resend refused email to ${message.to} (${response.status}): ${body.message ?? 'no reason given'}` +
            (message.link && this.env.NODE_ENV !== 'production' ? `\n  Link: ${message.link}` : ''),
        );
      }
    } catch (error) {
      // An email failure must not fail the request that triggered it.
      this.logger.error(`Could not send email to ${message.to}: ${(error as Error).message}`);
    }
  }

  link(path: string): string {
    return new URL(path, this.env.APP_URL).toString();
  }
}
