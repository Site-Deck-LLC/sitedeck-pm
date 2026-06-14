/**
 * Email Service (nodemailer → VPS Postfix)
 * ============================================================================
 * Sprint 9 Task 4 + Sprint 11. Transactional email for critical PM events.
 * V1: RFI overdue alerts, IFC release notifications, owner report
 * ready, NCR alerts, the welcome email (used by team management),
 * and the bug-approval email (Sprint 10 sendApprovalEmail).
 *
 * Transport: nodemailer → 127.0.0.1:587 (Postfix submission, STARTTLS)
 *   - SASL auth as `helper@modestintent.com` (mailbox added 2026-06-14
 *     in `mailserver.mailbox` per MAIL_SERVER_AUDIT.md).
 *   - TLS cert on the mail server is `mail.modestintent.com`, so we
 *     set `tls.servername` to match — otherwise nodemailer sees a
 *     hostname mismatch on the STARTTLS handshake (Postfix presents
 *     `mail.modestintent.com`, client targets `127.0.0.1`).
 *   - OpenDKIM already signs `*@modestintent.com`, so mail sent as
 *     `helper@modestintent.com` is DKIM-signed. Receiving MTAs
 *     (Gmail, Outlook) will see `dkim=pass` and not flag as spam.
 *
 * Scope: internal operational alerts only. Customer-facing mail
 * (welcome emails, RFI alerts to external recipients, owner
 * reports) currently also goes through this transport, with a
 * `Reply-To: support@sitedeck.pro` so the user can still respond
 * to a real address. Once `sitedeck.pro` has SPF + DKIM + DMARC
 * published in DNS and OpenDKIM signs `*@sitedeck.pro`, swap
 * `MAIL_FROM` to `support@sitedeck.pro` and we're done.
 *
 * Standalone degradation: sendEmail() NEVER throws. Failures are
 * logged at `console.warn` and the caller continues. The toast /
 * notification row is the source of truth for the user.
 * ============================================================================
 */

import nodemailer, { Transporter } from 'nodemailer';

let cachedTransport: Transporter | null = null;
let transportBuilt = false;

function getTransport(): Transporter | null {
  if (transportBuilt) return cachedTransport;
  transportBuilt = true;

  const host = process.env.MAIL_HOST;
  if (!host) {
    // Graceful fallback: no transport, calls go to console.log.
    return (cachedTransport = null);
  }

  try {
    cachedTransport = nodemailer.createTransport({
      host,
      port: parseInt(process.env.MAIL_PORT || '587', 10),
      secure: false, // STARTTLS on 587
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
      tls: {
        // Cert is CN=mail.modestintent.com. We're connecting to
        // 127.0.0.1, so we have to set servername explicitly for
        // SNI / hostname verification to match the cert.
        servername: 'mail.modestintent.com',
        rejectUnauthorized: true,
      },
    });
  } catch (err: any) {
    console.warn('[email] failed to build transport:', err?.message || err);
    cachedTransport = null;
  }
  return cachedTransport;
}

const FROM_DEFAULT = 'SiteDeck Helper <helper@modestintent.com>';
const FROM_EMAIL = process.env.MAIL_FROM || FROM_DEFAULT;
const REPLY_TO = process.env.MAIL_REPLY_TO || 'support@sitedeck.pro';

// Test-only cache reset. Production callers should never invoke this.
export const __test__ = {
  resetTransport(): void {
    cachedTransport = null;
    transportBuilt = false;
  },
};

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  bcc?: boolean;
}

export interface SendEmailResult {
  ok: boolean;
  sent: number;
  messageId: string | null;
  fallback: boolean; // true when no transport and we logged instead
  error?: string;
}

/**
 * Send (or log) an email. Never throws. Returns a result the
 * caller can log or surface in a 200 response.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const recipients = Array.isArray(input.to) ? input.to : [input.to];
  if (recipients.length === 0) {
    return { ok: false, sent: 0, messageId: null, fallback: false, error: 'no recipients' };
  }

  const transport = getTransport();
  if (!transport) {
    // Graceful fallback: log the email. The PM still gets the in-app
    // notification row; the email is best-effort.
    console.warn(
      `[email] MAIL_HOST not set — would have sent to=${recipients.join(',')} subject="${input.subject}"`
    );
    return { ok: true, sent: recipients.length, messageId: null, fallback: true };
  }

  try {
    const info = await transport.sendMail({
      from: FROM_EMAIL,
      to: input.bcc && recipients.length > 1 ? recipients[0] : recipients,
      cc: undefined,
      bcc: input.bcc && recipients.length > 1 ? recipients.slice(1) : undefined,
      replyTo: REPLY_TO,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true, sent: recipients.length, messageId: info?.messageId || null, fallback: false };
  } catch (err: any) {
    console.warn('[email] send failed:', err?.message || err);
    return {
      ok: false,
      sent: 0,
      messageId: null,
      fallback: false,
      error: err?.message || 'unknown',
    };
  }
}

// ─── Convenience senders ────────────────────────────────────────────────
//
// All callers go through sendEmail() so the graceful-fallback path
// (no MAIL_HOST → console.log) applies uniformly.

export async function sendRfiOverdueAlert(input: {
  rfiId: string;
  rfiNumber: string;
  recipientEmail: string;
  projectName: string;
  daysOpen: number;
  link: string;
}): Promise<SendEmailResult> {
  return sendEmail({
    to: input.recipientEmail,
    subject: `RFI Follow-Up Required: ${input.rfiNumber}`,
    text: `RFI ${input.rfiNumber} on project "${input.projectName}" is ${input.daysOpen} days open and still requires a response.\n\nView in SiteDeck PM: ${input.link}\n`,
  });
}

export async function sendOwnerReportReady(input: {
  reportId: string;
  ownerEmail: string;
  projectName: string;
  weekEnding: string;
  link: string;
}): Promise<SendEmailResult> {
  return sendEmail({
    to: input.ownerEmail,
    subject: `Weekly Status Report: ${input.projectName}`,
    text: `Your weekly status report for "${input.projectName}" (week ending ${input.weekEnding}) is ready.\n\nView in SiteDeck PM: ${input.link}\n`,
  });
}

export async function sendDrawingIFCRelease(input: {
  documentId: string;
  drawingNumber: string;
  title: string;
  revision: string | number;
  projectName: string;
  recipientEmails: string[];
  link: string;
}): Promise<SendEmailResult> {
  return sendEmail({
    to: input.recipientEmails,
    subject: `IFC Drawing Released: ${input.drawingNumber}`,
    text: `${input.drawingNumber} Rev ${input.revision} — ${input.title}\nReleased for construction on project "${input.projectName}".\n\nDownload in SiteDeck PM: ${input.link}\n`,
    bcc: true,
  });
}

export async function sendWelcomeEmail(input: {
  recipientEmail: string;
  displayName: string;
  projectName: string;
  role: string;
  loginLink: string;
}): Promise<SendEmailResult> {
  // Customer-facing today. When sitedeck.pro DNS / DKIM is in place,
  // swap MAIL_FROM in /opt/sitedeck-pm/.env to support@sitedeck.pro —
  // no code change required.
  return sendEmail({
    to: input.recipientEmail,
    subject: `You've been added to ${input.projectName}`,
    text: `Welcome to ${input.projectName}, ${input.displayName}.\n\nYou have been added with the role: ${input.role}.\nSign in to SiteDeck PM: ${input.loginLink}\n`,
  });
}

export async function sendNCRAlert(input: {
  ncrId: string;
  ncrNumber: string;
  severity: string;
  recipientEmail: string;
  projectName: string;
  dfow: string;
  benchmarkLink?: string;
}): Promise<SendEmailResult> {
  const text = `NCR ${input.ncrNumber} opened on project "${input.projectName}".\nSeverity: ${input.severity}\nDFOW: ${input.dfow}\n${input.benchmarkLink ? `View in Benchmark: ${input.benchmarkLink}\n` : ''}`;
  return sendEmail({
    to: input.recipientEmail,
    subject: `NCR Opened: ${input.ncrNumber} — Action Required`,
    text,
  });
}
