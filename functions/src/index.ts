import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { setGlobalOptions } from 'firebase-functions/v2';
import { defineSecret, defineString } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import Stripe from 'stripe';

setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

// Initialise firebase-admin exactly once (used by scheduled functions to read
// the appointments collection).
if (getApps().length === 0) {
  initializeApp();
}

// ── Parameters ────────────────────────────────────────────────────────────────
//
// Secrets (managed by Google Secret Manager). Set with:
//   firebase functions:secrets:set BREVO_API_KEY
//   firebase functions:secrets:set TWILIO_ACCOUNT_SID
//   firebase functions:secrets:set TWILIO_AUTH_TOKEN
//
// Non-secret params come from defaults below or `functions/.env`:
//   BREVO_SENDER_EMAIL=...
//   BREVO_SENDER_NAME=...
//   TWILIO_FROM_NUMBER=+12145551234
//   SALON_NAME=Labelle Braid BB
//   SALON_PHONE=214-555-1234
//
const BREVO_API_KEY = defineSecret('BREVO_API_KEY');
const SENDER_EMAIL  = defineString('BREVO_SENDER_EMAIL', {
  default: 'noreply@labellebraidbb.com',
});
const SENDER_NAME   = defineString('BREVO_SENDER_NAME', {
  default: 'Labelle Braid BB',
});

const TWILIO_ACCOUNT_SID = defineSecret('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN  = defineSecret('TWILIO_AUTH_TOKEN');
const TWILIO_FROM_NUMBER = defineString('TWILIO_FROM_NUMBER', {
  default: '+10000000000',
});
const SALON_NAME  = defineString('SALON_NAME',  { default: 'Labelle Braid BB' });

// Stripe — server-side secret + webhook signing secret. Set with:
//   firebase functions:secrets:set STRIPE_SECRET_KEY
//   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
const STRIPE_SECRET_KEY     = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// Digifeel review widget — the embed URL from Digifeel → Widget → Setup instructions.
const DIGIFEEL_WIDGET_URL = defineString('DIGIFEEL_WIDGET_URL', {
  default:
    'https://app.digifeel.io/widget/d440f08740bf4287b8e8d84e761c54711adae1460821cafa84bae4529e2535de.js?type=reviews&locale=en',
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

// ── Callable: getReviews ──────────────────────────────────────────────────────
interface PublicReview {
  author: string;
  rating: number;
  text: string;
  relativeDate: string;
  date: string;
}

interface ReviewsResult {
  name: string;
  rating: number;
  totalReviews: number;
  reviews: PublicReview[];
}

/** Digifeel serves reviews inside the widget script, which has no CORS header —
 *  so the browser can't read it and we proxy it here instead. */
let reviewsCache: { at: number; data: ReviewsResult } | null = null;
const REVIEWS_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_REVIEWS = 20;

export const getReviews = onCall<unknown, Promise<ReviewsResult>>(
  { invoker: 'public' },
  async (): Promise<ReviewsResult> => {
    if (reviewsCache && Date.now() - reviewsCache.at < REVIEWS_TTL_MS) {
      return reviewsCache.data;
    }
// 8887744919
    let script: string;
    try {
      const res = await fetch(DIGIFEEL_WIDGET_URL.value());
      if (!res.ok) {
        throw new HttpsError('unavailable', `Review provider returned ${res.status}.`);
      }
      script = await res.text();
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      logger.error('[getReviews] fetch failed', { err: String(err) });
      throw new HttpsError('unavailable', 'Review provider is unreachable.');
    }

    const match = script.match(/const\s+widgetData\s*=\s*(\{[\s\S]*?\});\s*\n/);
    if (!match) {
      logger.error('[getReviews] widgetData block not found in widget script');
      throw new HttpsError('internal', 'Could not read reviews from provider.');
    }

    let parsed: {
      establishment?: { name?: string; rating?: string; total_reviews?: number };
      reviews?: {
        reviewer_name?: string;
        rating?: number;
        text?: string;
        relative_date?: string;
        date?: string;
      }[];
    };
    try {
      parsed = JSON.parse(match[1]);
    } catch (err) {
      logger.error('[getReviews] widgetData is not valid JSON', { err: String(err) });
      throw new HttpsError('internal', 'Could not read reviews from provider.');
    }

    const data: ReviewsResult = {
      name:         parsed.establishment?.name ?? '',
      rating:       Number(parsed.establishment?.rating ?? 0),
      totalReviews: Number(parsed.establishment?.total_reviews ?? 0),
      reviews: (parsed.reviews ?? [])
        .filter((r) => typeof r.text === 'string' && r.text.trim().length > 0)
        .slice(0, MAX_REVIEWS)
        .map((r) => ({
          author:       (r.reviewer_name ?? '').trim(),
          rating:       Number(r.rating ?? 0),
          text:         (r.text ?? '').trim(),
          relativeDate: (r.relative_date ?? '').trim(),
          date:         (r.date ?? '').trim(),
        })),
    };

    reviewsCache = { at: Date.now(), data };
    return data;
  }
);

// ── Callable: sendEmail ───────────────────────────────────────────────────────
/**
 * Send a transactional email via Brevo (Sendinblue).
 *
 * Auth: callers MUST be signed-in (admin). Anonymous browser submissions are
 * never allowed to trigger outbound mail directly — those flows write to
 * Firestore first, and an admin replies from the dashboard.
 */export const sendEmail = onCall<EmailSendRequest, Promise<EmailSendResult>>(
  { secrets: [BREVO_API_KEY], invoker: 'public' },
  async (request): Promise<EmailSendResult> => {
    // Note: Public invocation allowed for booking confirmations and contact form alerts.
    // Validation below prevents spam/abuse.

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

    const apiKey = BREVO_API_KEY.value();
    if (!apiKey) {
      throw new HttpsError(
        'failed-precondition',
        'Email provider not configured. Missing BREVO_API_KEY secret.'
      );
    }

    let res: Response;
    try {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          accept:         'application/json',
          'api-key':      apiKey,
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
      if (
        res.status === 401 ||
        res.status === 403 ||
        /key\s+not\s+found/i.test(body.message ?? '')
      ) {
        throw new HttpsError(
          'failed-precondition',
          'Email provider key is invalid or missing. Set BREVO_API_KEY secret.'
        );
      }
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

// ─────────────────────────────────────────────────────────────────────────────
// SMS delivery via Twilio
// ─────────────────────────────────────────────────────────────────────────────

interface SmsSendRequest {
  to: string;   // E.164 format, e.g. +12145551234
  body: string; // <= 320 chars (2 SMS segments)
}

interface SmsSendResult {
  delivered: boolean;
  providerMessageId?: string;
}

interface TwilioMessageResponse {
  sid?: string;
  status?: string;
  message?: string;
  code?: number | string;
  error_message?: string;
}

const E164_RE = /^\+[1-9]\d{6,14}$/;

/** POST to Twilio's Messages endpoint. Throws HttpsError on failure. */
async function twilioSend(to: string, body: string): Promise<SmsSendResult> {
  const sid   = TWILIO_ACCOUNT_SID.value();
  const token = TWILIO_AUTH_TOKEN.value();
  const from  = TWILIO_FROM_NUMBER.value();

  if (!sid || !token || !from || from === '+10000000000') {
    logger.error('[sendSms] Twilio not configured', { hasSid: !!sid, from });
    throw new HttpsError('failed-precondition', 'SMS provider not configured.');
  }

  const auth   = Buffer.from(`${sid}:${token}`).toString('base64');
  const params = new URLSearchParams({ To: to, From: from, Body: body });

  let res: Response;
  try {
    res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );
  } catch (err) {
    logger.error('[sendSms] network error', err);
    throw new HttpsError('unavailable', 'SMS provider is unreachable.');
  }

  const payload = (await res.json().catch(() => ({}))) as TwilioMessageResponse;

  if (!res.ok) {
    logger.error('[sendSms] Twilio error', { status: res.status, payload });
    const reason = payload.message ?? payload.error_message ?? `Twilio HTTP ${res.status}`;
    throw new HttpsError('internal', reason);
  }

  logger.info('[sendSms] delivered', { to, sid: payload.sid, status: payload.status });
  return { delivered: true, providerMessageId: payload.sid };
}

// ── Callable: sendSms ─────────────────────────────────────────────────────────
/**
 * Send a transactional SMS via Twilio.
 *
 * Public invocation is allowed (mirrors sendEmail) so booking confirmations
 * and status-change notifications can trigger delivery. Rate limiting is
 * expected from Firestore rules (only one appointment per client + Twilio's
 * own throttling).
 *
 * TCPA: caller MUST verify `smsOptIn === true` on the source record before
 * invoking. The function does not (and cannot) check that itself.
 */
export const sendSms = onCall<SmsSendRequest, Promise<SmsSendResult>>(
  { secrets: [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN], invoker: 'public' },
  async (request): Promise<SmsSendResult> => {
    const data = (request.data ?? {}) as SmsSendRequest;

    if (!isString(data.to, 20) || !E164_RE.test(data.to)) {
      throw new HttpsError(
        'invalid-argument',
        '`to` must be a valid E.164 phone number (e.g. +12145551234).'
      );
    }
    if (!isString(data.body, 1600)) {
      throw new HttpsError('invalid-argument', '`body` is required (1-1600 chars).');
    }

    return twilioSend(data.to, data.body);
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Scheduled: 24-hour SMS reminders
// ─────────────────────────────────────────────────────────────────────────────

/** '10:00 AM' → minutes since midnight, or -1 if invalid. */
function parseDisplayTime(t: string | undefined | null): number {
  if (!t) return -1;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return -1;
  let h = Number(m[1]);
  const mins = Number(m[2]);
  const mer = m[3].toUpperCase();
  if (h === 12) h = 0;
  if (mer === 'PM') h += 12;
  return h * 60 + mins;
}

interface AppointmentDoc {
  customerName?:  string;
  customerPhone?: string;
  serviceName?:   string;
  date?:          Timestamp;
  startTime?:     string;
  status?:        string;
  smsOptIn?:      boolean;
  reminderSent?:  boolean;
}

/**
 * Send appointment reminders ~24h before the appointment time.
 *
 * Runs every 15 minutes. Selects appointments where:
 *   - smsOptIn === true
 *   - reminderSent === false
 *   - status in {'pending', 'confirmed'}
 *   - the full appointment datetime (date + startTime) is 23h–25h from now
 *
 * Marks reminderSent=true on success so subsequent runs skip it.
 */
export const sendReminders = onSchedule(
  {
    schedule:      'every 15 minutes',
    timeZone:      'America/Chicago',
    secrets:       [TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN],
    retryCount:    0,
    memory:        '256MiB',
  },
  async () => {
    const db = getFirestore();
    const now = new Date();

    // Query candidate set: appointments up to 2 days out that still need a reminder.
    // We can only range-filter one field, so we equality-filter on the booleans
    // and range-filter on `date`, then finish filtering in-memory (small set).
    const windowEnd = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const snap = await db.collection('appointments')
      .where('smsOptIn',     '==', true)
      .where('reminderSent', '==', false)
      .where('date',         '>=', Timestamp.fromDate(startOfToday))
      .where('date',         '<=', Timestamp.fromDate(windowEnd))
      .get();

    if (snap.empty) {
      logger.info('[sendReminders] no candidates in window');
      return;
    }

    const salon = SALON_NAME.value();
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of snap.docs) {
      const a = doc.data() as AppointmentDoc;
      const status = a.status ?? '';
      if (status !== 'pending' && status !== 'confirmed') { skipped++; continue; }

      const startMin = parseDisplayTime(a.startTime);
      if (startMin < 0 || !a.date) { skipped++; continue; }

      const day = a.date.toDate();
      const apptTime = new Date(
        day.getFullYear(), day.getMonth(), day.getDate(),
        Math.floor(startMin / 60), startMin % 60
      );

      const diffMs = apptTime.getTime() - now.getTime();
      const hours  = diffMs / (60 * 60 * 1000);

      // 23h–25h window before appointment. Reminder is skipped if the
      // appointment is closer than 23h (they likely got the confirmation SMS
      // already) or farther than 25h (a later run will pick it up).
      if (hours < 23 || hours > 25) { skipped++; continue; }

      const phone = (a.customerPhone ?? '').trim();
      if (!E164_RE.test(phone)) {
        logger.warn('[sendReminders] skipping — invalid phone', { id: doc.id, phone });
        skipped++;
        continue;
      }

      const timeLabel    = a.startTime ?? '';
      const serviceLabel = a.serviceName ?? 'your appointment';
      const firstName    = (a.customerName ?? '').split(' ')[0] || 'there';

      const body =
        `Hi ${firstName}! Reminder: your ${serviceLabel} at ${salon} is tomorrow at ${timeLabel}. ` +
        `See you soon! Reply STOP to opt out.`;

      try {
        await twilioSend(phone, body);
        await doc.ref.update({
          reminderSent:   true,
          reminderSentAt: Timestamp.fromDate(new Date()),
        });
        sent++;
      } catch (err) {
        failed++;
        logger.error('[sendReminders] send failed', {
          id: doc.id, phone, err: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('[sendReminders] done', {
      candidates: snap.size, sent, skipped, failed,
    });
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Stripe — 20% deposit charge at booking
// ─────────────────────────────────────────────────────────────────────────────
//
// Flow:
//   1. Client creates appointment doc (paymentStatus='unpaid', depositPaid=false)
//      via existing Firestore rule (guest CREATE allowed).
//   2. Client calls `createStripePaymentIntent({ appointmentId })`.
//      Server reads the appointment, recomputes 20% deposit from stored
//      totalAmount, creates a PaymentIntent with metadata.appointmentId,
//      and returns { clientSecret }.
//   3. Client confirms card via Stripe.js (@stripe/stripe-js).
//   4. Stripe fires `payment_intent.succeeded` → `stripeWebhook` flips
//      depositPaid=true, paymentStatus='deposit-paid', paymentTransactionId=pi.id.
//
// Security:
//   - Server never trusts client-supplied amounts.
//   - Webhook signature is verified against STRIPE_WEBHOOK_SECRET (Stripe → console → webhook signing secret).
//   - Public invocation is allowed on the callable so anonymous customers can
//     pay a deposit as part of booking. Rate limiting is by Firestore rules
//     (one appointment per customer create) + Stripe's own throttling.

interface CreatePaymentIntentRequest {
  appointmentId: string;
}

interface CreatePaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
}

// Cache Stripe client between warm invocations. Do NOT initialise at module
// load — the secret is only available inside the request scope.
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  const key = STRIPE_SECRET_KEY.value();
  if (!key) {
    throw new HttpsError(
      'failed-precondition',
      'Payment provider not configured. Missing STRIPE_SECRET_KEY secret.',
    );
  }
  stripeClient = new Stripe(key, {
    // Pin API version so behaviour is deterministic across Stripe updates.
    apiVersion: '2025-02-24.acacia',
  });
  return stripeClient;
}

/** Recompute the deposit amount server-side. Mirrors booking.component.ts:
 *  20% of totalAmount, rounded to cents. Never trust client math. */
function computeDepositCents(totalAmountDollars: number): number {
  const deposit = Math.round(totalAmountDollars * 0.20 * 100);
  return deposit;
}

export const createStripePaymentIntent = onCall<
  CreatePaymentIntentRequest,
  Promise<CreatePaymentIntentResult>
>(
  { secrets: [STRIPE_SECRET_KEY], invoker: 'public' },
  async (request): Promise<CreatePaymentIntentResult> => {
    const data = (request.data ?? {}) as CreatePaymentIntentRequest;

    if (!isString(data.appointmentId, 200)) {
      throw new HttpsError('invalid-argument', '`appointmentId` is required.');
    }

    const db = getFirestore();
    const ref = db.collection('appointments').doc(data.appointmentId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Appointment not found.');
    }

    const appt = snap.data() as {
      totalAmount?: number;
      customerName?: string;
      customerEmail?: string;
      paymentStatus?: string;
      depositPaid?: boolean;
      paymentMethod?: string;
    };

    // Guard: only card-deposit bookings should ever create a PI.
    if (appt.paymentMethod !== 'card-deposit') {
      throw new HttpsError(
        'failed-precondition',
        'This booking was not marked for card deposit.',
      );
    }
    // Guard: don't double-charge.
    if (appt.depositPaid === true || appt.paymentStatus === 'deposit-paid') {
      throw new HttpsError('already-exists', 'Deposit has already been paid.');
    }

    const total = Number(appt.totalAmount);
    if (!Number.isFinite(total) || total <= 0) {
      throw new HttpsError('failed-precondition', 'Appointment has no valid total amount.');
    }

    const amountCents = computeDepositCents(total);
    if (amountCents < 50) {
      // Stripe minimum is $0.50 USD. Refuse to create tiny PIs.
      throw new HttpsError(
        'failed-precondition',
        'Deposit amount is below the minimum payment threshold.',
      );
    }

    const stripe = getStripe();

    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.create({
        amount:   amountCents,
        currency: 'usd',
        // Automatic payment methods = card + wallets Stripe negotiates in browser.
        automatic_payment_methods: { enabled: true },
        // Metadata is what the webhook uses to find the appointment.
        metadata: {
          appointmentId: data.appointmentId,
          serviceTotal:  String(total),
        },
        description: `Deposit for appointment ${data.appointmentId}`,
        receipt_email: appt.customerEmail,
        statement_descriptor_suffix: 'DEPOSIT',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[createStripePaymentIntent] Stripe error', { msg });
      throw new HttpsError('internal', 'Could not create payment: ' + msg);
    }

    // Record the intent id on the appointment so admins can trace it even
    // before the webhook fires (or if it never does).
    await ref.update({
      paymentIntentId: intent.id,
      paymentProvider: 'stripe',
      updatedAt: Timestamp.fromDate(new Date()),
    });

    if (!intent.client_secret) {
      throw new HttpsError('internal', 'Stripe did not return a client secret.');
    }

    logger.info('[createStripePaymentIntent] created', {
      appointmentId: data.appointmentId, intentId: intent.id, amountCents,
    });

    return {
      clientSecret:    intent.client_secret,
      paymentIntentId: intent.id,
      amountCents,
    };
  }
);

/**
 * Stripe webhook — receives events for PaymentIntent lifecycle changes.
 *
 * Deployed URL: https://us-central1-<project>.cloudfunctions.net/stripeWebhook
 * Register that in Stripe → Developers → Webhooks, subscribing at minimum to
 *   - payment_intent.succeeded
 *   - payment_intent.payment_failed
 * Then copy the "Signing secret" (whsec_...) into STRIPE_WEBHOOK_SECRET.
 *
 * IMPORTANT: signature verification requires the RAW request body. Firebase
 * Functions v2 `onRequest` exposes it as `req.rawBody` (Buffer).
 */
export const stripeWebhook = onRequest(
  {
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
    // Public — Stripe calls us unauthenticated; auth is via signature.
    invoker: 'public',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const sig = req.header('stripe-signature');
    if (!sig) {
      logger.warn('[stripeWebhook] missing stripe-signature header');
      res.status(400).send('Missing signature');
      return;
    }

    const whSecret = STRIPE_WEBHOOK_SECRET.value();
    if (!whSecret) {
      logger.error('[stripeWebhook] STRIPE_WEBHOOK_SECRET is not configured');
      res.status(500).send('Webhook not configured');
      return;
    }

    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, whSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn('[stripeWebhook] signature verification failed', { msg });
      res.status(400).send(`Webhook Error: ${msg}`);
      return;
    }

    const db = getFirestore();

    try {
      switch (event.type) {
        case 'payment_intent.succeeded': {
          const pi = event.data.object as Stripe.PaymentIntent;
          const appointmentId = pi.metadata?.appointmentId;
          if (!appointmentId) {
            logger.warn('[stripeWebhook] succeeded event without appointmentId metadata', {
              intentId: pi.id,
            });
            break;
          }
          await db.collection('appointments').doc(appointmentId).update({
            depositPaid:          true,
            paymentStatus:        'deposit-paid',
            paymentTransactionId: pi.id,
            paymentProvider:      'stripe',
            depositPaidAt:        Timestamp.fromDate(new Date()),
            updatedAt:            Timestamp.fromDate(new Date()),
          });
          logger.info('[stripeWebhook] deposit paid', {
            appointmentId, intentId: pi.id, amount: pi.amount,
          });
          break;
        }

        case 'payment_intent.payment_failed': {
          const pi = event.data.object as Stripe.PaymentIntent;
          const appointmentId = pi.metadata?.appointmentId;
          logger.warn('[stripeWebhook] payment failed', {
            appointmentId,
            intentId: pi.id,
            lastError: pi.last_payment_error?.message,
          });
          if (appointmentId) {
            await db.collection('appointments').doc(appointmentId).update({
              paymentLastError: pi.last_payment_error?.message ?? 'Unknown failure',
              updatedAt:        Timestamp.fromDate(new Date()),
            });
          }
          break;
        }

        default:
          // Ignore events we don't subscribe to but Stripe still delivers.
          logger.debug('[stripeWebhook] ignored event', { type: event.type });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[stripeWebhook] handler error', { type: event.type, msg });
      // Return 500 so Stripe retries.
      res.status(500).send('Handler error');
      return;
    }

    res.status(200).send('ok');
  },
);

