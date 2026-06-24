import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';

/**
 * EmailService
 *
 * Outgoing email is dispatched via the `sendEmail` Firebase Cloud Function
 * (see functions/src/index.ts), which in turn calls Brevo's transactional
 * email API server-side. The Brevo API key never enters the browser bundle
 * — it lives in Secret Manager and is injected only into the function.
 *
 * Callers should treat `delivered = false` as a soft failure: the admin UI
 * still persists a reply log so nothing is lost, and the `error` message is
 * surfaced for diagnosis.
 */
export interface EmailSendRequest {
  to:       string;
  toName?:  string;
  subject:  string;
  bodyText: string;
  bodyHtml?: string;
  replyTo?: string;
}

export interface EmailSendResult {
  delivered: boolean;
  providerMessageId?: string;
  /** Set when delivered=false. Surfaced to admin UI. */
  error?: string;
}

interface CallableResult {
  delivered: boolean;
  providerMessageId?: string;
}

@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly functions = inject(Functions);

  async send(req: EmailSendRequest): Promise<EmailSendResult> {
    try {
      const callable = httpsCallable<EmailSendRequest, CallableResult>(
        this.functions,
        'sendEmail'
      );
      const result = await callable(req);
      return {
        delivered:         !!result.data.delivered,
        providerMessageId: result.data.providerMessageId,
      };
    } catch (err: unknown) {
      const msg = this.extractMessage(err);
      // eslint-disable-next-line no-console
      console.error('[EmailService] send failed', err);
      return { delivered: false, error: msg };
    }
  }

  /**
   * Pull a human-friendly message out of a callable error. Firebase Functions
   * surface `HttpsError.message` via `.message` and a stable code via
   * `.code` (e.g. 'functions/unauthenticated'). For typical wiring problems
   * (function not deployed, secret missing) the SDK throws 'functions/internal'
   * or 'functions/not-found'.
   */
  private extractMessage(err: unknown): string {
    if (err && typeof err === 'object') {
      const e = err as { code?: string; message?: string; details?: unknown };
      if (e.code === 'functions/not-found') {
        return 'sendEmail function is not deployed yet (functions/not-found).';
      }
      if (e.code === 'functions/unauthenticated') {
        return 'You must be signed in to send email.';
      }
      if (e.message) return e.message;
    }
    return err instanceof Error ? err.message : String(err);
  }
}
