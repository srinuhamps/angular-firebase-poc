import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppointmentsService } from '../../core/services/appointments.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
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
  private readonly apptService = inject(AppointmentsService);
  private readonly confirmSvc  = inject(ConfirmService);
  private readonly toast       = inject(ToastService);

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
    this.updatingId.set(appt.id);
    try {
      await this.apptService.updateStatus(appt.id, status);
      // Optimistic local update so the table re-renders instantly.
      this.appointments.update((list) =>
        list.map((a) => (a.id === appt.id ? { ...a, status, updatedAt: new Date() } : a))
      );
    } finally {
      this.updatingId.set(null);
    }
  }

  async delete(appt: Appointment): Promise<void> {
    const ok = await this.confirmSvc.ask({
      title:       'Delete appointment?',
      message:     `The appointment for ${appt.customerName} on ${this.formatDate(appt.date)} will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete',
      danger:      true,
    });
    if (!ok) return;
    this.updatingId.set(appt.id);
    try {
      await this.apptService.delete(appt.id);
      this.appointments.update((list) => list.filter((a) => a.id !== appt.id));
      this.toast.success(`Deleted appointment for ${appt.customerName}.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Could not delete appointment: ' + msg);
    } finally {
      this.updatingId.set(null);
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
}
