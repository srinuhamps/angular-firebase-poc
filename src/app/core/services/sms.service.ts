import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Appointment, AppointmentStatus } from '../models/appointment.model';

/**
 * SmsService
 *
 * Outgoing SMS is dispatched via the `sendSms` Firebase Cloud Function
 * (see functions/src/index.ts), which in turn calls Twilio's REST API
 * server-side. The Twilio credentials never enter the browser bundle —
 * they live in Secret Manager and are injected only into the function.
 *
 * TCPA compliance: callers MUST verify `appt.smsOptIn === true` before
 * invoking any of the template methods below. The helper methods here
 * short-circuit to a no-op when opt-in is false to make this safer.
 */
export interface SmsSendRequest {
  to:   string; // E.164, e.g. '+12145551234'
  body: string;
}

export interface SmsSendResult {
  delivered: boolean;
  providerMessageId?: string;
  /** Set when delivered=false. Surfaced to admin UI. */
  error?: string;
  /** True when the send was skipped client-side (opt-out or missing phone). */
  skipped?: boolean;
}

interface CallableResult {
  delivered: boolean;
  providerMessageId?: string;
}

const SALON_NAME = 'Labelle Braid BB';
const SMS_FOOTER = 'Reply STOP to opt out.';

@Injectable({ providedIn: 'root' })
export class SmsService {
  private readonly functions = inject(Functions);

  /** Raw send. Callers should prefer the templated helpers below. */
  async send(req: SmsSendRequest): Promise<SmsSendResult> {
    try {
      const callable = httpsCallable<SmsSendRequest, CallableResult>(
        this.functions,
        'sendSms'
      );
      const result = await callable(req);
      return {
        delivered:         !!result.data.delivered,
        providerMessageId: result.data.providerMessageId,
      };
    } catch (err: unknown) {
      const msg = this.extractMessage(err);
      // eslint-disable-next-line no-console
      console.error('[SmsService] send failed', err);
      return { delivered: false, error: msg };
    }
  }

  // ── Template: Booking confirmation ─────────────────────────────────────────

  async sendBookingConfirmation(appt: Appointment): Promise<SmsSendResult> {
    const phone = pickPhone(appt);
    if (!phone) return skip('no opt-in or no phone');

    const date = shortDate(appt.date);
    const first = firstName(appt.customerName);

    const body =
      `Hi ${first}! Your ${appt.serviceName} appointment at ${SALON_NAME} ` +
      `is booked for ${date} at ${appt.startTime}. ${SMS_FOOTER}`;

    return this.send({ to: phone, body: truncateSms(body) });
  }

  // ── Template: Status change ────────────────────────────────────────────────

  async sendStatusChangeNotification(
    appt: Appointment,
    newStatus: AppointmentStatus
  ): Promise<SmsSendResult> {
    const phone = pickPhone(appt);
    if (!phone) return skip('no opt-in or no phone');

    const date = shortDate(appt.date);
    let message: string;

    switch (newStatus) {
      case 'confirmed':
        message =
          `Good news! Your ${appt.serviceName} appointment on ${date} at ${appt.startTime} ` +
          `is confirmed. ${SALON_NAME}. ${SMS_FOOTER}`;
        break;
      case 'cancelled':
        message =
          `Your ${appt.serviceName} appointment on ${date} at ${appt.startTime} ` +
          `has been cancelled. Please call to reschedule. ${SALON_NAME}. ${SMS_FOOTER}`;
        break;
      case 'completed':
        message =
          `Thank you for visiting ${SALON_NAME}! We hope you loved your ${appt.serviceName}. ` +
          SMS_FOOTER;
        break;
      case 'no-show':
        // No SMS for no-show — admin handles offline.
        return skip('no-show does not trigger SMS');
      default:
        return skip('status change does not warrant SMS');
    }

    return this.send({ to: phone, body: truncateSms(message) });
  }

  // ── Diagnostics ────────────────────────────────────────────────────────────

  private extractMessage(err: unknown): string {
    if (err && typeof err === 'object') {
      const e = err as { code?: string; message?: string };
      if (e.code === 'functions/not-found') {
        return 'sendSms function is not deployed yet.';
      }
      if (e.code === 'functions/failed-precondition') {
        return 'SMS provider is not configured (Twilio credentials missing).';
      }
      if (e.message) return e.message;
    }
    return err instanceof Error ? err.message : String(err);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert a free-form phone string to E.164 for US numbers.
 * Returns '' if the number can't be normalised.
 *
 * Rules:
 *   - Strip all non-digits (and the leading '+').
 *   - 10 digits           → prepend '+1' (US default)
 *   - 11 digits w/ '1'    → prepend '+'
 *   - Otherwise           → invalid
 */
export function normalizeUsPhone(input: string | undefined | null): string {
  if (!input) return '';
  const digits = input.replace(/[^\d]/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return '';
}

function pickPhone(appt: Appointment): string {
  if (!appt.smsOptIn) return '';
  const raw = appt.smsPhone ?? appt.customerPhone ?? '';
  return normalizeUsPhone(raw);
}

function firstName(fullName: string): string {
  return (fullName ?? '').trim().split(/\s+/)[0] || 'there';
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
  });
}

/** Twilio charges per 160-char segment. Keep messages under 320 chars. */
function truncateSms(s: string): string {
  return s.length <= 320 ? s : s.slice(0, 317) + '...';
}

function skip(reason: string): SmsSendResult {
  return { delivered: false, skipped: true, error: reason };
}
