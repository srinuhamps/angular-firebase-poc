import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppointmentsService } from '../../core/services/appointments.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { EmailService } from '../../core/services/email.service';
import { SmsService } from '../../core/services/sms.service';
import { Appointment, AppointmentStatus } from '../../core/models/appointment.model';

type StatusFilter = AppointmentStatus | 'all' | 'upcoming';

@Component({
  selector: 'app-admin-appointments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-appointments.component.html',
  styleUrl: './admin-appointments.component.scss',
})
export class AdminAppointmentsComponent {
  private readonly apptService  = inject(AppointmentsService);
  private readonly confirmSvc   = inject(ConfirmService);
  private readonly toast        = inject(ToastService);
  private readonly emailService = inject(EmailService);
  private readonly smsService   = inject(SmsService);

  readonly appointments = signal<Appointment[]>([]);
  readonly loading      = signal<boolean>(true);
  readonly updatingId   = signal<string | null>(null);
  readonly statusFilter = signal<StatusFilter>('upcoming');

  readonly filters: { label: string; value: StatusFilter }[] = [
    { label: 'Upcoming',  value: 'upcoming'  },
    { label: 'Pending',   value: 'pending'   },
    { label: 'Confirmed', value: 'confirmed' },
    { label: 'Completed', value: 'completed' },
    { label: 'Cancelled', value: 'cancelled' },
    { label: 'No-show',   value: 'no-show'   },
    { label: 'All',       value: 'all'       },
  ];

  readonly filtered = computed<Appointment[]>(() => {
    const f = this.statusFilter();
    const all = this.appointments();
    if (f === 'all') return all;
    if (f === 'upcoming') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return all.filter(
        (a) => a.date.getTime() >= today.getTime() && a.status !== 'cancelled'
      );
    }
    return all.filter((a) => a.status === f);
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    let knownIds: Set<string> | null = null;
    this.apptService.watchAll().subscribe({
      next: (list) => {
        // First emission — seed the "known" set, no toasts.
        if (knownIds === null) {
          knownIds = new Set(list.map((a) => a.id));
        } else {
          // Subsequent emissions — surface arrivals.
          for (const a of list) {
            if (!knownIds.has(a.id) && a.status === 'pending') {
              this.toast.info(
                `New booking from ${a.customerName} (${a.serviceName})`,
                { title: 'Appointment requested' }
              );
            }
            knownIds.add(a.id);
          }
        }
        this.appointments.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[AdminAppointments] live stream failed', err);
        this.loading.set(false);
      },
    });
  }

  async setStatus(appt: Appointment, status: AppointmentStatus): Promise<void> {
    // Ask for confirmation before making a state change. Cancel is destructive
    // (customer-visible + refund implications), so it gets the danger styling.
    const prompt = this.confirmPromptFor(appt, status);
    const ok = await this.confirmSvc.ask({
      title:       prompt.title,
      message:     prompt.message,
      confirmText: prompt.confirmText,
      danger:      prompt.danger,
    });
    if (!ok) return;

    this.updatingId.set(appt.id);
    try {
      await this.apptService.updateStatus(appt.id, status);
      // Optimistic local update so the table re-renders instantly.
      this.appointments.update((list) =>
        list.map((a) => (a.id === appt.id ? { ...a, status, updatedAt: new Date() } : a))
      );

      // Send status change notification email to customer (fire and forget)
      this.emailService.sendStatusChangeNotification(appt, status).catch((err) => {
        console.error('[AdminAppointments] status change email failed', err);
      });

      // Send matching SMS if the customer opted in at booking (TCPA).
      if (appt.smsOptIn) {
        this.smsService.sendStatusChangeNotification(appt, status).catch((err) => {
          console.error('[AdminAppointments] status change SMS failed', err);
        });
      }

      this.toast.success(prompt.successMessage, { title: prompt.successTitle });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Could not update appointment: ' + msg);
    } finally {
      this.updatingId.set(null);
    }
  }

  /** Copy for the confirm + toast messages per status transition. */
  private confirmPromptFor(
    appt: Appointment,
    status: AppointmentStatus,
  ): {
    title: string;
    message: string;
    confirmText: string;
    danger: boolean;
    successTitle: string;
    successMessage: string;
  } {
    const who = appt.customerName;
    const when = `${this.formatDate(appt.date)} at ${appt.startTime}`;
    switch (status) {
      case 'confirmed':
        return {
          title:          'Confirm appointment?',
          message:        `Confirm the appointment for ${who} on ${when}? The customer will receive a confirmation email${appt.smsOptIn ? ' and SMS' : ''}.`,
          confirmText:    'Confirm',
          danger:         false,
          successTitle:   'Appointment confirmed',
          successMessage: `${who}'s appointment on ${when} is confirmed.`,
        };
      case 'completed':
        return {
          title:          'Mark as completed?',
          message:        `Mark ${who}'s appointment on ${when} as completed? A thank-you email${appt.smsOptIn ? ' and SMS' : ''} will be sent.`,
          confirmText:    'Mark completed',
          danger:         false,
          successTitle:   'Appointment completed',
          successMessage: `${who}'s appointment has been marked completed.`,
        };
      case 'no-show':
        return {
          title:          'Mark as no-show?',
          message:        `Mark ${who}'s appointment on ${when} as a no-show? The customer will be notified.`,
          confirmText:    'Mark no-show',
          danger:         true,
          successTitle:   'Marked no-show',
          successMessage: `${who}'s appointment has been marked as no-show.`,
        };
      case 'cancelled':
        return {
          title:          'Cancel appointment?',
          message:        `Cancel ${who}'s appointment on ${when}? ${appt.depositPaid ? 'Note: the customer paid a deposit — refund manually in the Stripe dashboard if applicable. ' : ''}The customer will be notified.`,
          confirmText:    'Cancel appointment',
          danger:         true,
          successTitle:   'Appointment cancelled',
          successMessage: `${who}'s appointment has been cancelled.`,
        };
      case 'pending':
      default:
        return {
          title:          'Update status?',
          message:        `Change ${who}'s appointment to "${status}"?`,
          confirmText:    'Update',
          danger:         false,
          successTitle:   'Status updated',
          successMessage: `${who}'s appointment status is now ${status}.`,
        };
    }
  }

  formatDate(d: Date): string {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month:   'short',
      day:     'numeric',
      year:    'numeric',
    });
  }

  /** Build a link into the Stripe dashboard for a given PaymentIntent id.
   *  Test vs live is inferred from the id prefix (Stripe test PIs are the
   *  same shape as live but appear under /test/payments). */
  stripePaymentUrl(paymentIntentId: string): string {
    return `https://dashboard.stripe.com/payments/${paymentIntentId}`;
  }
}
