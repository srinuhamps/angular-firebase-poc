import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

// ── Parameters ────────────────────────────────────────────────────────────────
//
// BREVO_API_KEY is a secret managed by Google Secret Manager.
// Set with:
//   firebase functions:secrets:set BREVO_API_KEY
//
// Sender identity is configured via non-secret params (defaults below).
// Override per deploy with `.env` files in this directory:
//   functions/.env  ← BREVO_SENDER_EMAIL=...  BREVO_SENDER_NAME=...
//
const BREVO_API_KEY = defineSecret('BREVO_API_KEY');
const SENDER_EMAIL  = defineString('BREVO_SENDER_EMAIL', {
  default: 'noreply@carollehairstudio.com',
});
const SENDER_NAME   = defineString('BREVO_SENDER_NAME', {
  default: 'Labelle Braids BB',
});

// ── Types ─────────────────────────────────────────────────────────────────────
interface EmailSendRequest {
  to: string;
  toName?: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  replyTo?: string;
}

interface EmailSendResult {
  delivered: boolean;
  providerMessageId?: string;
}

interface BrevoResponse {
  messageId?: string;
  message?: string;
  code?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isString(v: unknown, maxLen: number): v is string {
  return typeof v === 'string' && v.length > 0 && v.length <= maxLen;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Callable: sendEmail ───────────────────────────────────────────────────────
/**
 * Send a transactional email via Brevo (Sendinblue).
 *
 * Auth: callers MUST be signed-in (admin). Anonymous browser submissions are
 * never allowed to trigger outbound mail directly — those flows write to
 * Firestore first, and an admin replies from the dashboard.
 */
export const sendEmail = onCall<EmailSendRequest, Promise<EmailSendResult>>(
  { secrets: [BREVO_API_KEY] },
  async (request): Promise<EmailSendResult> => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in to send email.');
    }

    const data = (request.data ?? {}) as EmailSendRequest;

    if (!isString(data.to, 200) || !EMAIL_RE.test(data.to)) {
      throw new HttpsError('invalid-argument', 'Valid `to` email is required.');
    }
    if (!isString(data.subject, 200)) {
      throw new HttpsError('invalid-argument', '`subject` is required (1-200 chars).');
    }
    if (!isString(data.bodyText, 50_000)) {
      throw new HttpsError('invalid-argument', '`bodyText` is required (1-50000 chars).');
    }
    if (data.replyTo !== undefined && !EMAIL_RE.test(data.replyTo)) {
      throw new HttpsError('invalid-argument', '`replyTo` must be a valid email.');
    }

    const html =
      data.bodyHtml && isString(data.bodyHtml, 200_000)
        ? data.bodyHtml
        : `<p>${escapeHtml(data.bodyText).replace(/\n/g, '<br>')}</p>`;

    const payload = {
      sender: { email: SENDER_EMAIL.value(), name: SENDER_NAME.value() },
      to: [{ email: data.to, ...(data.toName ? { name: data.toName } : {}) }],
      subject:     data.subject,
      textContent: data.bodyText,
      htmlContent: html,
      ...(data.replyTo
        ? { replyTo: { email: data.replyTo } }
        : {}),
    };

    let res: Response;
    try {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept:         'application/json',
          'api-key':      BREVO_API_KEY.value(),
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      logger.error('[sendEmail] network error', err);
      throw new HttpsError('unavailable', 'Email provider is unreachable.');
    }

    const body = (await res.json().catch(() => ({}))) as BrevoResponse;

    if (!res.ok) {
      logger.error('[sendEmail] Brevo error', { status: res.status, body });
      const reason = body.message ?? `Brevo HTTP ${res.status}`;
      throw new HttpsError('internal', reason);
    }

    logger.info('[sendEmail] delivered', {
      to: data.to,
      subject: data.subject,
      messageId: body.messageId,
    });

    return {
      delivered: true,
      providerMessageId: body.messageId,
    };
  }
);
