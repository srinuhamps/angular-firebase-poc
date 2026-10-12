import { Component, computed, effect, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  FormGroup,
} from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { ServicesService } from '../../core/services/services.service';
import { ServiceAddonsService } from '../../core/services/service-addons.service';
import { BusinessInfoService } from '../../core/services/business-info.service';
import { ToastService } from '../../core/services/toast.service';
import { EmailService } from '../../core/services/email.service';
import { SmsService, normalizeUsPhone } from '../../core/services/sms.service';
import { StripeService } from '../../core/services/stripe.service';
import { StripePaymentComponent } from './stripe-payment/stripe-payment.component';
import {
  AppointmentsService,
  formatDisplayTime,
  parseDisplayTime,
  toIsoDateString,
} from '../../core/services/appointments.service';

import {
  HairService,
  SERVICE_CATEGORIES,
  labelForCategory,
} from '../../core/models/hair-service.model';
import { Stylist } from '../../core/models/stylist.model';
import { BusinessInfo } from '../../core/models/business-info.model';
import { Appointment, AppointmentAddon } from '../../core/models/appointment.model';
import { ServiceAddon } from '../../core/models/service-addon.model';

type PaymentMethod = 'pay-in-store' | 'card-deposit';

interface WizardStep {
  num: string;
  label: string;
}

/** One day cell in the inline month calendar (step 2). */
interface CalendarCell {
  /** 'YYYY-MM-DD' */
  iso: string;
  /** 1–31 */
  day: number;
  /** Belongs to the visible month (vs. leading/trailing padding days). */
  inMonth: boolean;
  /** Salon is closed on this weekday. */
  closed: boolean;
  /** Configured holiday. */
  holiday: boolean;
  /** Before today or beyond the 90-day booking window. */
  outOfRange: boolean;
  /** Any of the above → not clickable. */
  disabled: boolean;
  isToday: boolean;
  isSelected: boolean;
}

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, StripePaymentComponent],
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss',
})
export class BookingComponent {
  private readonly fb           = inject(FormBuilder);
  private readonly route        = inject(ActivatedRoute);
  private readonly svcService   = inject(ServicesService);
  private readonly addonsSvc    = inject(ServiceAddonsService);
  private readonly bizService   = inject(BusinessInfoService);
  private readonly apptService  = inject(AppointmentsService);
  private readonly toast        = inject(ToastService);
  private readonly emailService = inject(EmailService);
  private readonly smsService   = inject(SmsService);
  private readonly stripeService = inject(StripeService);

  /** Signal-based ref to the Stripe card element (only present when the
   *  customer chose the card-deposit option on step 5). */
  readonly stripePayment = viewChild(StripePaymentComponent);

  /** Wizard steps shown in the progress bar. */
  readonly steps: WizardStep[] = [
    { num: '01', label: 'Select Service'   },
    { num: '02', label: 'Pick Date & Time' },
    { num: '03', label: 'Your Details'     },
    { num: '04', label: 'Confirm & Pay'    },
  ];

  /** 1-based current step. Step `steps.length + 1` = success view. */
  readonly currentStep = signal<number>(1);

  // ── Data sources ───────────────────────────────────────────────────────────
  readonly services      = signal<HairService[]>([]);
  readonly allAddons     = signal<ServiceAddon[]>([]);
  readonly businessInfo  = signal<BusinessInfo | null>(null);
  readonly loadingData   = signal<boolean>(true);
  readonly loadError     = signal<string>('');

  // ── Selections ─────────────────────────────────────────────────────────────
  readonly selectedService = signal<HairService | null>(null);
  /** Category slug picked in the first sub-step of Step 1. */
  readonly selectedCategory = signal<string>('');
  /** IDs of add-ons the customer has checked in step 1. */
  readonly selectedAddonIds = signal<string[]>([]);
  /** ISO 'YYYY-MM-DD' or '' if unset. */
  readonly selectedDateIso = signal<string>('');
  /** Display string like '10:00 AM' or '' if unset. */
  readonly selectedTime    = signal<string>('');

  /** Add-ons available for the currently selected service (active + applies-to
   *  matches). Empty if no service is picked yet. */
  readonly availableAddons = computed<ServiceAddon[]>(() => {
    const svc = this.selectedService();
    if (!svc) return [];
    const linked = svc.addonIds ?? [];
    return this.allAddons()
      .filter((a) => a.isActive)
      .filter((a) => a.appliesToAll || linked.includes(a.id));
  });

  /** Categories that have at least one bookable service, shown in the category picker. */
  readonly availableCategories = computed<{ value: string; label: string }[]>(() => {
    const svcs = this.services();
    const seen = new Set(svcs.map((s) => s.category));
    return SERVICE_CATEGORIES.filter((c) => seen.has(c.value));
  });

  /** Services matching the selected category. */
  readonly filteredServices = computed<HairService[]>(() => {
    const cat = this.selectedCategory();
    if (!cat) return [];
    return this.services().filter((s) => s.category === cat);
  });

  /** Full `ServiceAddon` objects for the IDs currently checked, filtered to
   *  those still available for the selected service (defensive against stale
   *  selections after a service change). */
  readonly selectedAddons = computed<ServiceAddon[]>(() => {
    const ids = new Set(this.selectedAddonIds());
    return this.availableAddons().filter((a) => ids.has(a.id));
  });

  /** Total duration (service + selected add-on deltas), clamped to ≥ 1 min so
   *  we never generate a zero-length appointment. */
  readonly effectiveDuration = computed<number>(() => {
    const base = this.selectedService()?.duration ?? 0;
    const delta = this.selectedAddons().reduce((s, a) => s + a.durationDelta, 0);
    return Math.max(1, base + delta);
  });

  /** Min date for the date input — today in local time. */
  readonly todayIso = toIsoDateString(new Date());
  /** Cap booking 90 days in the future. */
  readonly maxDateIso = toIsoDateString(
    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  );

  // ── Inline month calendar (step 2) ─────────────────────────────────────────
  /** First day (local midnight) of the month currently displayed in the calendar. */
  readonly calendarMonth = signal<Date>(startOfMonth(new Date()));

  readonly weekdayLabels: readonly string[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /** Human label for the visible month, e.g. "July 2026". */
  readonly calendarMonthLabel = computed<string>(() =>
    this.calendarMonth().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  /** 6-week (42-cell) grid for the visible month. Cells outside the month
   *  are still rendered but greyed out and non-clickable. */
  readonly calendarCells = computed<CalendarCell[]>(() => {
    const monthStart = this.calendarMonth();
    const year  = monthStart.getFullYear();
    const month = monthStart.getMonth();
    const firstCell = new Date(year, month, 1);
    firstCell.setDate(firstCell.getDate() - firstCell.getDay()); // Back up to Sunday

    const biz      = this.businessInfo();
    const today    = this.todayIso;
    const max      = this.maxDateIso;
    const selected = this.selectedDateIso();

    const cells: CalendarCell[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(firstCell.getFullYear(), firstCell.getMonth(), firstCell.getDate() + i);
      const iso     = toIsoDateString(d);
      const inMonth = d.getMonth() === month;
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
      const closed  = !!(biz?.businessHours ?? []).find((h) => h.day === dayName)?.isClosed;
      const holiday = !!(biz?.holidays ?? []).some((h) => h.date === iso);
      const outOfRange = iso < today || iso > max;
      cells.push({
        iso,
        day: d.getDate(),
        inMonth,
        closed,
        holiday,
        outOfRange,
        disabled: !inMonth || outOfRange || closed || holiday,
        isToday: iso === today,
        isSelected: iso === selected,
      });
    }
    return cells;
  });

  /** Whether the "‹" button should be enabled — hide when the previous month
   *  is entirely in the past. */
  readonly canGoPrevMonth = computed<boolean>(() => {
    const m = this.calendarMonth();
    const lastDayOfPrev = new Date(m.getFullYear(), m.getMonth(), 0);
    return toIsoDateString(lastDayOfPrev) >= this.todayIso;
  });

  /** Whether the "›" button should be enabled — hide when the next month
   *  is entirely beyond the booking window. */
  readonly canGoNextMonth = computed<boolean>(() => {
    const m = this.calendarMonth();
    const firstOfNext = new Date(m.getFullYear(), m.getMonth() + 1, 1);
    return toIsoDateString(firstOfNext) <= this.maxDateIso;
  });

  // ── Customer details form (step 4) ─────────────────────────────────────────
  readonly detailsForm: FormGroup = this.fb.group({
    name:     ['', [Validators.required, Validators.minLength(2)]],
    email:    ['', [Validators.required, Validators.email]],
    phone:    ['', [Validators.required, Validators.minLength(7)]],
    notes:    [''],
    smsOptIn: [false],
  });

  // ── Payment + submit (step 5) ──────────────────────────────────────────────
  readonly paymentMethod = signal<PaymentMethod>('pay-in-store');
  readonly submitting    = signal<boolean>(false);
  readonly submitError   = signal<string>('');
  readonly submittedId   = signal<string>('');

  /**
   * The Confirm button on step 4 is disabled while the appointment is being
   * submitted, and — when the customer chose the card deposit — until the
   * Stripe card element has loaded AND been filled in with a valid card.
   * This prevents accidentally creating an appointment before the deposit
   * is charged.
   */
  readonly canConfirm = computed<boolean>(() => {
    if (this.submitting()) return false;
    if (this.paymentMethod() === 'card-deposit') {
      const sp = this.stripePayment();
      if (!sp) return false;
      if (!sp.ready()) return false;
      if (!sp.complete()) return false;
    }
    return true;
  });

  // ── Form validity tracking for reactive updates ────────────────────────────
  readonly detailsFormValid = signal<boolean>(false);

  // ── Derived state ─────────────────────────────────────────────────────────

  /** Expose labelForCategory to template. */
  readonly labelForCategory = labelForCategory;

  /** How many bookable services exist for a given category slug. */
  countInCategory(cat: string): number {
    return this.services().filter((s) => s.category === cat).length;
  }

  readonly selectedDayName = computed<string>(() => {
    const iso = this.selectedDateIso();
    if (!iso) return '';
    return parseIsoDate(iso).toLocaleDateString('en-US', { weekday: 'long' });
  });

  /** Hours entry for the currently selected day, if any. */
  readonly selectedDayHours = computed(() => {
    const day = this.selectedDayName();
    const biz = this.businessInfo();
    if (!day || !biz) return null;
    return (biz.businessHours ?? []).find((h) => h.day === day) ?? null;
  });

  /** True when the selected date matches a configured holiday. */
  readonly isHoliday = computed<boolean>(() => {
    const iso = this.selectedDateIso();
    const biz = this.businessInfo();
    if (!iso || !biz) return false;
    return (biz.holidays ?? []).some((h) => h.date === iso);
  });

  /** Slot grid for the selected date + service: 30-min start times that fit
   *  the service (plus selected add-ons) duration within business hours.
   *  Existing appointments are intentionally ignored — slots are never blocked
   *  by other bookings. Falls back to 9 AM–7 PM when no business-hours record
   *  exists for the day (covers the case where Admin hasn't configured hours). */
  readonly slotOptions = computed<Array<{ time: string; available: boolean }>>(() => {
    const svc   = this.selectedService();
    if (!svc || this.isHoliday()) return [];

    const hours = this.selectedDayHours();
    if (hours?.isClosed) return [];

    // Determine open/close — fall back to 9 AM–7 PM if no record.
    const openMin  = hours ? parseDisplayTime(hours.open)  : 9 * 60;
    const closeMin = hours ? parseDisplayTime(hours.close) : 19 * 60;
    let openFinal  = openMin  < 0 ? 9  * 60 : openMin;
    let closeFinal = closeMin < 0 ? 19 * 60 : closeMin;
    // Smart PM recovery: if close ≤ open and close looks like a 12h-format
    // time (e.g. admin entered 07:00 meaning 7 PM), add 12 hours.
    if (closeFinal <= openFinal && closeFinal > 0 && closeFinal < 12 * 60) {
      closeFinal += 12 * 60;
    }
    if (closeFinal <= openFinal) return [];

    const stepMin  = 30;
    const duration = this.effectiveDuration();
    const isToday  = this.selectedDateIso() === this.todayIso;
    const now      = new Date();
    const nowMin   = now.getHours() * 60 + now.getMinutes();

    const out: Array<{ time: string; available: boolean }> = [];
    for (let start = openFinal; start + duration <= closeFinal; start += stepMin) {
      const inPast = isToday && start <= nowMin;
      out.push({
        time: formatDisplayTime(start),
        available: !inPast,
      });
    }
    return out;
  });

  /** Step-level validity gating the Next button. */
  readonly canAdvance = computed<boolean>(() => {
    switch (this.currentStep()) {
      case 1: return !!this.selectedService() && !!this.selectedCategory();
      case 2: return !!this.selectedDateIso() && !!this.selectedTime();
      case 3: return this.detailsFormValid();
      default: return false;
    }
  });

  /** Booking totals — service price + selected add-on deltas, clamped ≥ 0.
   *  20% deposit applies when card-deposit is selected. */
  readonly totals = computed(() => {
    const base = this.selectedService()?.price ?? 0;
    const addonDelta = this.selectedAddons().reduce((s, a) => s + a.priceDelta, 0);
    const total = Math.max(0, Math.round((base + addonDelta) * 100) / 100);
    const deposit = this.paymentMethod() === 'card-deposit'
      ? Math.max(0, Math.round(total * 0.2 * 100) / 100)
      : 0;
    return { total, deposit, dueAtSalon: total - deposit };
  });

  constructor() {
    this.loadAll();

    // Monitor details form validity reactively via statusChanges subscription
    this.detailsFormValid.set(this.detailsForm.valid);
    this.detailsForm.statusChanges.subscribe(() => {
      this.detailsFormValid.set(this.detailsForm.valid);
    });

    // Clear the chosen time whenever the date is cleared.
    effect(() => {
      if (!this.selectedDateIso()) this.selectedTime.set('');
    });

    // If the previously chosen time is no longer in the available list, drop it.
    effect(() => {
      const time = this.selectedTime();
      if (!time) return;
      const stillAvailable = this.slotOptions().some(
        (s) => s.time === time && s.available
      );
      if (!stillAvailable) this.selectedTime.set('');
    });
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  private loadAll(): void {
    this.loadingData.set(true);
    Promise.all([
      firstValueFrom(this.svcService.getAll()),
      firstValueFrom(this.addonsSvc.getAll()),
      firstValueFrom(this.bizService.get()),
    ])
      .then(([services, addons, biz]) => {
        this.services.set(
          services.filter((s) => s.isAvailable && s.bookingEnabled)
        );
        this.allAddons.set(addons);
        this.businessInfo.set(biz);
        this.loadingData.set(false);
        this.applyPreselectedService();
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.loadError.set(msg);
        this.loadingData.set(false);
      });
  }

  /**
   * If the user arrived at /booking?service=<id> (e.g. from a service card's
   * "Book Now" button), preselect that service and jump to step 2. Silently
   * ignores unknown or unbookable IDs so the user just starts at step 1.
   */
  private applyPreselectedService(): void {
    const id = this.route.snapshot.queryParamMap.get('service');
    if (!id) return;
    const match = this.services().find((s) => s.id === id);
    if (!match) return;
    // Pre-select category + service so the filtered list and add-ons are
    // immediately visible on step 1 — customer reviews add-ons before Next.
    this.selectedCategory.set(match.category);
    this.selectService(match);
    // Stay on step 1 (do NOT jump to 2) so "Enhance your appointment" is shown.
  }

  // ── Selection handlers ────────────────────────────────────────────────────

  selectCategory(cat: string): void {
    this.selectedCategory.set(cat);
    // Clear any previously selected service when switching categories.
    this.selectedService.set(null);
    this.selectedAddonIds.set([]);
    this.selectedTime.set('');
  }

  selectService(s: HairService): void {
    this.selectedService.set(s);
    // Changing service invalidates any previously chosen time (duration shift)
    // and clears the add-on picks (they may not apply to the new service).
    this.selectedTime.set('');
    this.selectedAddonIds.set([]);
  }

  /** Toggle an add-on in/out of the customer's selection. Called from the
   *  step-1 add-on checklist. */
  toggleAddon(addonId: string): void {
    this.selectedAddonIds.update((ids) =>
      ids.includes(addonId) ? ids.filter((x) => x !== addonId) : [...ids, addonId]
    );
    // Duration changed → invalidate previously chosen time slot.
    this.selectedTime.set('');
  }

  isAddonSelected(addonId: string): boolean {
    return this.selectedAddonIds().includes(addonId);
  }

  onDateChange(value: string): void {
    this.selectedDateIso.set(value);
  }

  /** Move the visible calendar month by ±1. Wrapped in a helper so the
   *  template stays terse and the guard rails live in one place. */
  prevMonth(): void {
    if (!this.canGoPrevMonth()) return;
    const m = this.calendarMonth();
    this.calendarMonth.set(new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  nextMonth(): void {
    if (!this.canGoNextMonth()) return;
    const m = this.calendarMonth();
    this.calendarMonth.set(new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }

  /** Click handler for a day cell in the inline calendar. */
  selectDay(cell: CalendarCell): void {
    if (cell.disabled) return;
    this.onDateChange(cell.iso);
  }

  selectTime(time: string): void {
    this.selectedTime.set(time);
  }

  setPayment(method: PaymentMethod): void {
    this.paymentMethod.set(method);
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  next(): void {
    if (!this.canAdvance()) return;
    this.currentStep.update((n) => Math.min(n + 1, this.steps.length));
    scrollToTop();
  }

  back(): void {
    this.currentStep.update((n) => Math.max(n - 1, 1));
    scrollToTop();
  }

  /** Allow jumping back to a previously completed step via the progress bar. */
  goToStep(n: number): void {
    if (n >= 1 && n < this.currentStep()) {
      this.currentStep.set(n);
      scrollToTop();
    }
  }

  // ── Submission ────────────────────────────────────────────────────────────

  async submit(): Promise<void> {
    const svc = this.selectedService();
    const iso = this.selectedDateIso();
    const time = this.selectedTime();
    if (!svc || !iso || !time) return;
    if (this.detailsForm.invalid) {
      this.detailsForm.markAllAsTouched();
      this.toast.warning('Please complete your contact details.');
      return;
    }

    // Extra guard: if card-deposit is selected, make absolutely sure the Stripe
    // card element is loaded and the card is filled in before we do anything.
    // The button is already disabled in this state, but this defends against
    // races (e.g. viewChild not yet tracking the new component instance).
    if (this.paymentMethod() === 'card-deposit') {
      const sp = this.stripePayment();
      if (!sp || !sp.ready()) {
        this.toast.warning('Please wait for the secure card form to finish loading.');
        return;
      }
      if (!sp.complete()) {
        this.toast.warning('Please enter your card details to pay the deposit.');
        return;
      }
    }

    this.submitting.set(true);
    this.submitError.set('');

    const startMin  = parseDisplayTime(time);
    const duration  = this.effectiveDuration();
    const endMin    = startMin + duration;
    const startTime = formatDisplayTime(startMin);
    const endTime   = formatDisplayTime(endMin);
    const totals    = this.totals();
    const v         = this.detailsForm.value as {
      name: string; email: string; phone: string; notes: string; smsOptIn: boolean;
    };

    // Normalise phone to E.164 for SMS. If it can't be normalised the user
    // still gets email notifications; SMS is just skipped downstream.
    const smsPhone = normalizeUsPhone(v.phone);
    const smsOptIn = !!v.smsOptIn && !!smsPhone;

    // Denormalise picked add-ons — store a snapshot (id/name/price/duration)
    // so historical appointments are still readable if an add-on is later
    // edited or deleted.
    const pickedAddons = this.selectedAddons();
    const addonsSnapshot: AppointmentAddon[] = pickedAddons.map((a) => ({
      id:            a.id,
      name:          a.name,
      priceDelta:    a.priceDelta,
      durationDelta: a.durationDelta,
    }));

    const appt: Omit<Appointment, 'id'> = {
      customerName:  v.name.trim(),
      customerEmail: v.email.trim(),
      customerPhone: v.phone.trim(),
      serviceId:     svc.id,
      serviceName:   svc.name,
      servicePrice:  svc.price,
      stylistId:     '',
      stylistName:   '',
      date:          parseIsoDate(iso),
      startTime,
      endTime,
      duration,
      status:        'pending',
      paymentStatus: 'unpaid',
      totalAmount:   totals.total,
      depositAmount: totals.deposit,
      depositPaid:   false, // Phase 2: flip true after real payment provider integration.
      paymentMethod: this.paymentMethod(),
      notes:         v.notes?.trim() || undefined,
      createdAt:     new Date(),
      smsOptIn,
      smsPhone:      smsOptIn ? smsPhone : undefined,
      ...(addonsSnapshot.length > 0 ? { addons: addonsSnapshot } : {}),
    };

    try {
      const id = await this.apptService.create(appt);
      this.submittedId.set(id);

      const apptWithId: Appointment = { ...appt, id };

      // If the customer chose the card deposit, run Stripe now. The appointment
      // is already saved so if payment fails the admin can still see it and
      // reach out; we won't send success notifications until the charge lands.
      if (this.paymentMethod() === 'card-deposit') {
        const paymentComp = this.stripePayment();
        if (!paymentComp) {
          throw new Error('Payment form is not available. Please refresh and try again.');
        }

        // 1) Ask the server to create a PaymentIntent for this appointment.
        const { clientSecret } = await this.stripeService.createPaymentIntent(id);

        // 2) Confirm the card client-side against that PaymentIntent.
        const paymentResult = await paymentComp.confirm(clientSecret, appt.customerName);
        if (!paymentResult.success) {
          // Do NOT throw — surface the error, let them retry the card without
          // creating a duplicate appointment. The submitted appt stays in
          // 'pending' / 'unpaid' so the admin can follow up if needed.
          this.submitError.set(paymentResult.error ?? 'Payment could not be completed.');
          this.toast.error(paymentResult.error ?? 'Payment could not be completed.');
          return;
        }

        // Optimistic local update — the webhook flips these on the server too.
        apptWithId.depositPaid = true;
        apptWithId.paymentStatus = 'deposit-paid';
        apptWithId.paymentTransactionId = paymentResult.paymentIntentId;
      }

      // Send confirmation emails (fire and forget, don't block success)
      this.emailService.sendBookingConfirmation(apptWithId).catch((err) => {
        console.error('[Booking] confirmation email failed', err);
      });

      const biz = this.businessInfo();
      if (biz?.email) {
        this.emailService.sendNewBookingAlert(apptWithId, biz.email).catch((err) => {
          console.error('[Booking] admin alert email failed', err);
        });
      }

      // Send confirmation SMS if the customer opted in (TCPA).
      if (apptWithId.smsOptIn) {
        this.smsService.sendBookingConfirmation(apptWithId).catch((err) => {
          console.error('[Booking] confirmation SMS failed', err);
        });
      }

      this.toast.success(
        `Booking requested for ${svc.name} on ${formatDateLong(appt.date)} at ${startTime}.`,
        { title: 'Appointment submitted' }
      );
      this.currentStep.set(this.steps.length + 1); // Success view.
      scrollToTop();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.submitError.set(msg);
      this.toast.error('Could not submit booking: ' + msg);
    } finally {
      this.submitting.set(false);
    }
  }

  resetWizard(): void {
    this.selectedService.set(null);
    this.selectedAddonIds.set([]);
    this.selectedDateIso.set('');
    this.selectedTime.set('');
    this.detailsForm.reset({ name: '', email: '', phone: '', notes: '', smsOptIn: false });
    this.paymentMethod.set('pay-in-store');
    this.submittedId.set('');
    this.submitError.set('');
    this.currentStep.set(1);
    scrollToTop();
  }

  // ── Display helpers used by the template ──────────────────────────────────

  formatPrice(n: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(n);
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
  }

  /** Signed dollar delta, e.g. `+$15` or `−$10`. Zero renders as `Free`. */
  formatPriceDelta(n: number): string {
    if (n === 0) return 'Free';
    const sign = n > 0 ? '+' : '−';
    const abs = Math.abs(n);
    const body = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(abs);
    return `${sign}${body}`;
  }

  /** Signed minute delta, e.g. `+30 min` or `−1h 15m`. Zero renders as `same time`. */
  formatDurationDelta(min: number): string {
    if (min === 0) return 'same time';
    const sign = min > 0 ? '+' : '−';
    const abs = Math.abs(min);
    if (abs < 60) return `${sign}${abs} min`;
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m === 0 ? `${sign}${h}h` : `${sign}${h}h ${m}m`;
  }

  formatDateLong(iso: string): string {
    if (!iso) return '';
    return formatDateLong(parseIsoDate(iso));
  }

  /** Telephone link with non-digit characters stripped. */
  telHref(phone: string | undefined): string {
    return 'tel:' + (phone ?? '').replace(/[^\d+]/g, '');
  }
}

// ── Module-local helpers ──────────────────────────────────────────────────────

/** Parse 'YYYY-MM-DD' as a local-time Date at midnight. */
function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** First day of the month containing `d`, local midnight. */
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
    year:    'numeric',
  });
}

function scrollToTop(): void {
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
