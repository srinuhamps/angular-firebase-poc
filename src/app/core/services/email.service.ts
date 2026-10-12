import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Appointment, AppointmentStatus } from '../models/appointment.model';
import { ContactMessage } from '../models/contact-message.model';
import { environment } from '../../../environments/environment';

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

  // ── Template: Booking Confirmation ─────────────────────────────────────────

  async sendBookingConfirmation(appt: Appointment): Promise<EmailSendResult> {
    const date = appt.date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // Payment breakdown — shown only when the customer chose card-deposit.
    const isCardDeposit = appt.paymentMethod === 'card-deposit';
    const depositAmt    = appt.depositAmount ?? 0;
    const balanceAtSalon = Math.max(0, (appt.totalAmount ?? 0) - depositAmt);
    const paymentBlockText = isCardDeposit
      ? `\nPayment\n────────────────────\nDeposit paid:      $${depositAmt.toFixed(2)}${appt.depositPaid ? ' (✓ received)' : ' (processing)'}\nDue at salon:      $${balanceAtSalon.toFixed(2)}\nTotal:             $${appt.totalAmount}\n`
      : `\nPayment: Full amount ($${appt.totalAmount}) due at the salon.\n`;
    const paymentBlockHtml = isCardDeposit
      ? `
  <div style="background: #eef7ee; border: 1px solid #c8e6c9; padding: 14px 16px; border-radius: 8px; margin: 16px 0;">
    <p style="margin: 0 0 8px 0; font-weight: bold; color: #2e7d32;">${appt.depositPaid ? '✓ Deposit received' : 'Deposit processing'}</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 3px 0;">Deposit paid</td><td style="padding: 3px 0; text-align: right;"><strong>$${depositAmt.toFixed(2)}</strong></td></tr>
      <tr><td style="padding: 3px 0;">Balance due at salon</td><td style="padding: 3px 0; text-align: right;"><strong>$${balanceAtSalon.toFixed(2)}</strong></td></tr>
      <tr style="border-top: 1px solid #c8e6c9;"><td style="padding: 6px 0 0 0;">Total</td><td style="padding: 6px 0 0 0; text-align: right;"><strong>$${appt.totalAmount}</strong></td></tr>
    </table>
  </div>`
      : `
  <div style="background: #fff8e1; border: 1px solid #ffe0b2; padding: 14px 16px; border-radius: 8px; margin: 16px 0;">
    <p style="margin: 0; color: #6d4c00;">💳 Pay in full at the salon: <strong>$${appt.totalAmount}</strong>. We accept cash and card.</p>
  </div>`;

    // Add-ons list (denormalised snapshot on the appointment).
    const addonsTextLines = (appt.addons ?? [])
      .map((a) => `  • ${a.name} (+$${a.priceDelta})`)
      .join('\n');
    const addonsText = addonsTextLines ? `\nAdd-ons:\n${addonsTextLines}\n` : '';
    const addonsHtml = (appt.addons ?? []).length
      ? `<p style="margin: 4px 0 0 0;"><strong>Add-ons:</strong><br>${(appt.addons ?? [])
          .map((a) => `• ${escapeHtml(a.name)} (+$${a.priceDelta})`)
          .join('<br>')}</p>`
      : '';

    const bodyText = `
Your appointment request has been submitted!

Service: ${appt.serviceName}
${appt.stylistName ? `Stylist: ${appt.stylistName}` : 'Stylist: To be assigned'}
Date: ${date}
Time: ${appt.startTime} - ${appt.endTime}
Duration: ${appt.duration} minutes
${addonsText}${paymentBlockText}
Name: ${appt.customerName}
Phone: ${appt.customerPhone}

${appt.notes ? `Notes: ${appt.notes}\n` : ''}

We will confirm your appointment by phone or email within 24 hours. 
If you need to cancel or reschedule, please call or reply to this email.

Thank you for choosing us!
    `.trim();

    const bodyHtml = `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <h2 style="color: #c9a96e;">Appointment Confirmation</h2>
  <p>Your appointment request has been submitted!</p>

  <div style="background: #f5f0e8; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <p><strong>Service:</strong> ${appt.serviceName}</p>
    <p><strong>Stylist:</strong> ${appt.stylistName || '<em>To be assigned</em>'}</p>
    <p><strong>Date:</strong> ${date}</p>
    <p><strong>Time:</strong> ${appt.startTime} - ${appt.endTime}</p>
    <p><strong>Duration:</strong> ${appt.duration} minutes</p>
    ${addonsHtml}
  </div>

  ${paymentBlockHtml}

  <p><strong>Contact:</strong><br>
  ${appt.customerName}<br>
  ${appt.customerPhone}</p>

  ${appt.notes ? `<p><strong>Notes:</strong> ${escapeHtml(appt.notes)}</p>` : ''}

  <p>We will confirm your appointment by phone or email within 24 hours.</p>
  <p><em>If you need to cancel or reschedule, please call or reply to this email.</em></p>
</div>
    `.trim();

    return this.send({
      to: appt.customerEmail,
      toName: appt.customerName,
      subject: `Appointment Confirmation — ${appt.serviceName}`,
      bodyText,
      bodyHtml,
    });
  }

  // ── Template: New Booking Alert (Admin) ─────────────────────────────────────

  async sendNewBookingAlert(appt: Appointment, adminEmail: string): Promise<EmailSendResult> {
    const date = appt.date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    // Payment summary line for the admin.
    const isCardDeposit = appt.paymentMethod === 'card-deposit';
    const depositAmt    = appt.depositAmount ?? 0;
    const balanceAtSalon = Math.max(0, (appt.totalAmount ?? 0) - depositAmt);
    const paymentSummaryText = isCardDeposit
      ? `Payment: Card deposit — $${depositAmt.toFixed(2)} ${appt.depositPaid ? 'PAID' : 'PENDING'} · $${balanceAtSalon.toFixed(2)} due at salon`
      : `Payment: Pay-in-store — $${appt.totalAmount} due at salon`;
    const paymentSummaryHtml = isCardDeposit
      ? (appt.depositPaid
          ? `<span style="background: #eef7ee; color: #2e7d32; padding: 3px 8px; border-radius: 4px; font-weight: bold;">✓ Deposit paid: $${depositAmt.toFixed(2)}</span> <span style="color: #666;">· Balance at salon: $${balanceAtSalon.toFixed(2)}</span>`
          : `<span style="background: #fff3cd; color: #856404; padding: 3px 8px; border-radius: 4px; font-weight: bold;">Deposit pending: $${depositAmt.toFixed(2)}</span> <span style="color: #666;">· Balance at salon: $${balanceAtSalon.toFixed(2)}</span>`)
      : `<span style="color: #666;">Pay-in-store — $${appt.totalAmount} due at salon</span>`;

    // Add-ons list.
    const addonsTextLines = (appt.addons ?? [])
      .map((a) => `  • ${a.name} (+$${a.priceDelta})`)
      .join('\n');
    const addonsText = addonsTextLines ? `\nAdd-ons:\n${addonsTextLines}\n` : '';
    const addonsHtml = (appt.addons ?? []).length
      ? `<p style="margin: 4px 0 0 0;"><strong>Add-ons:</strong><br>${(appt.addons ?? [])
          .map((a) => `• ${escapeHtml(a.name)} (+$${a.priceDelta})`)
          .join('<br>')}</p>`
      : '';

    const bodyText = `
NEW BOOKING REQUEST

Service: ${appt.serviceName}
${appt.stylistName ? `Stylist: ${appt.stylistName}` : 'Stylist: NOT ASSIGNED - Assign manually in dashboard'}
Date: ${date}
Time: ${appt.startTime} - ${appt.endTime}
Duration: ${appt.duration} minutes
Total: $${appt.totalAmount}
${addonsText}
${paymentSummaryText}
${appt.paymentTransactionId ? `Stripe PaymentIntent: ${appt.paymentTransactionId}\n` : ''}
Customer: ${appt.customerName}
Email: ${appt.customerEmail}
Phone: ${appt.customerPhone}

${appt.notes ? `Customer Notes: ${appt.notes}\n` : ''}

Status: PENDING CONFIRMATION

Log in to the admin dashboard to confirm or decline this booking.
    `.trim();

    const bodyHtml = `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <h2 style="color: #c9a96e;">New Booking Request</h2>

  <div style="background: #fff3cd; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <p><strong>Service:</strong> ${appt.serviceName}</p>
    <p><strong>Stylist:</strong> ${appt.stylistName ? appt.stylistName : '<span style="color: #d9534f;">NOT ASSIGNED</span> — Assign in dashboard'}</p>
    <p><strong>Date:</strong> ${date}</p>
    <p><strong>Time:</strong> ${appt.startTime} - ${appt.endTime}</p>
    <p><strong>Duration:</strong> ${appt.duration} minutes</p>
    <p><strong>Total:</strong> $${appt.totalAmount}</p>
    ${addonsHtml}
  </div>

  <div style="padding: 10px 14px; border: 1px solid #e0d7c9; border-radius: 8px; margin: 16px 0;">
    ${paymentSummaryHtml}
    ${appt.paymentTransactionId ? `<div style="margin-top: 8px; font-size: 12px; color: #666;">Stripe PaymentIntent: <code>${escapeHtml(appt.paymentTransactionId)}</code></div>` : ''}
  </div>

  <p><strong>Customer:</strong><br>
  ${appt.customerName}<br>
  <a href="mailto:${appt.customerEmail}">${appt.customerEmail}</a><br>
  <a href="tel:${appt.customerPhone}">${appt.customerPhone}</a></p>

  ${appt.notes ? `<p><strong>Customer Notes:</strong> ${escapeHtml(appt.notes)}</p>` : ''}

  <p style="color: #d9534f;"><strong>Status: PENDING CONFIRMATION</strong></p>
  <p><a href="${environment.siteUrl}/admin/appointments" style="color: #c9a96e; text-decoration: none; font-weight: bold;">View in Dashboard →</a></p>
</div>
    `.trim();

    const subjectPrefix = isCardDeposit && appt.depositPaid ? '💰 PAID' : '📅 New';
    return this.send({
      to: adminEmail,
      subject: `${subjectPrefix} Booking: ${appt.customerName} — ${appt.serviceName}`,
      bodyText,
      bodyHtml,
    });
  }

  // ── Template: Message Alert (Admin) ────────────────────────────────────────

  async sendMessageAlert(msg: ContactMessage, adminEmail: string): Promise<EmailSendResult> {
    const bodyText = `
NEW MESSAGE

From: ${msg.name} <${msg.email}>
Phone: ${msg.phone}
Subject: ${msg.subject}

${msg.message}
    `.trim();

    const bodyHtml = `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <h2 style="color: #c9a96e;">New Message from Website</h2>
  
  <p><strong>From:</strong> ${msg.name}<br>
  <strong>Email:</strong> <a href="mailto:${msg.email}">${msg.email}</a><br>
  <strong>Phone:</strong> <a href="tel:${msg.phone}">${msg.phone}</a></p>
  
  <p><strong>Subject:</strong> ${msg.subject}</p>
  
  <div style="background: #f5f0e8; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <p>${escapeHtml(msg.message).replace(/\n/g, '<br>')}</p>
  </div>
  
  <p><a href="${environment.siteUrl}/admin/messages" style="color: #c9a96e; text-decoration: none; font-weight: bold;">Reply in Dashboard →</a></p>
</div>
    `.trim();

    return this.send({
      to: adminEmail,
      subject: `💬 New Message: ${msg.subject}`,
      bodyText,
      bodyHtml,
    });
  }

  // ── Template: Status Change Notification ───────────────────────────────────

  async sendStatusChangeNotification(
    appt: Appointment,
    newStatus: AppointmentStatus
  ): Promise<EmailSendResult> {
    const date = appt.date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    let statusMessage = '';
    let statusColor = '#666';

    switch (newStatus) {
      case 'confirmed':
        statusMessage =
          'Your appointment has been confirmed! We look forward to seeing you.';
        statusColor = '#28a745';
        break;
      case 'cancelled':
        statusMessage =
          'Your appointment has been cancelled. Please contact us to reschedule.';
        statusColor = '#dc3545';
        break;
      case 'completed':
        statusMessage =
          'Thank you for choosing us! We hope you enjoyed your appointment.';
        statusColor = '#17a2b8';
        break;
      case 'no-show':
        statusMessage = 'You did not show up for your appointment.';
        statusColor = '#dc3545';
        break;
      default:
        statusMessage = `Your appointment status has been updated to: ${newStatus}`;
    }

    const bodyText = `
APPOINTMENT STATUS UPDATE

Service: ${appt.serviceName}
${appt.stylistName ? `Stylist: ${appt.stylistName}` : 'Stylist: To be assigned'}
Date: ${date}
Time: ${appt.startTime} - ${appt.endTime}

${statusMessage}

If you have any questions, please contact us.
    `.trim();

    const bodyHtml = `
<div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
  <h2 style="color: ${statusColor};">Appointment Status Update</h2>
  
  <p style="color: ${statusColor}; font-size: 18px; font-weight: bold;">${statusMessage}</p>
  
  <div style="background: #f5f0e8; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <p><strong>Service:</strong> ${appt.serviceName}</p>
    <p><strong>Stylist:</strong> ${appt.stylistName ? appt.stylistName : '<em>To be assigned</em>'}</p>
    <p><strong>Date:</strong> ${date}</p>
    <p><strong>Time:</strong> ${appt.startTime} - ${appt.endTime}</p>
  </div>
  
  <p>If you have any questions, please contact us.</p>
</div>
    `.trim();

    return this.send({
      to: appt.customerEmail,
      toName: appt.customerName,
      subject: `Appointment Status: ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      bodyText,
      bodyHtml,
    });
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
      if (e.code === 'functions/failed-precondition') {
        return 'Email provider is not configured (invalid/missing Brevo API key).';
      }
      if (e.message) return e.message;
    }
    return err instanceof Error ? err.message : String(err);
  }
}

// ── Helper ────────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
