import { Injectable } from '@nestjs/common';

/**
 * Delivery port for password-reset emails (FR-AUTH-05).
 *
 * ponytail: no SMTP provider is wired yet (no creds in .env, no new dep). The
 * only implementation logs the reset link to the server console, guarded to
 * non-production so a raw token never reaches a prod log stream. Upgrade path:
 * add nodemailer + SMTP_* env vars, swap this provider in AuthModule, keep the
 * interface — AuthService stops caring.
 */
export interface ResetMailer {
  sendResetEmail(email: string, rawToken: string): Promise<void>;
}

/** DI token so AuthModule can swap in an SMTP mailer without touching AuthService. */
export const RESET_MAILER = Symbol('RESET_MAILER');

@Injectable()
export class ConsoleResetMailer implements ResetMailer {
  async sendResetEmail(email: string, rawToken: string): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      // Silent drop beats a false promise; real delivery needs the SMTP port.
      return;
    }
    const base = process.env.RESET_LINK_BASE_URL ?? 'http://localhost:3000/reset-password';
    // eslint-disable-next-line no-console
    console.log(`[auth] password reset for ${email} → ${base}?token=${rawToken} (dev mailer, 15 min TTL)`);
  }
}
