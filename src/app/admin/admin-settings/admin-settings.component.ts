import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JsonPipe } from '@angular/common';
import { BusinessInfoService } from '../../core/services/business-info.service';
import {
  BusinessInfo,
  BusinessHours,
  Holiday,
} from '../../core/models/business-info.model';

type FormState = BusinessInfo;

/** The seven weekday shells used when the Firestore doc has no hours yet. */
const EMPTY_WEEK: BusinessHours[] = [
  { day: 'Monday',    open: '', close: '', isClosed: false },
  { day: 'Tuesday',   open: '', close: '', isClosed: false },
  { day: 'Wednesday', open: '', close: '', isClosed: false },
  { day: 'Thursday',  open: '', close: '', isClosed: false },
  { day: 'Friday',    open: '', close: '', isClosed: false },
  { day: 'Saturday',  open: '', close: '', isClosed: false },
  { day: 'Sunday',    open: '', close: '', isClosed: true  },
];

/** Truly empty BusinessInfo — used when config/business does not exist yet. */
function makeEmptyBusinessInfo(): BusinessInfo {
  return {
    id: 'business',
    name: '',
    tagline: '',
    description: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    phone: '',
    email: '',
    website: '',
    instagramUrl: '',
    facebookUrl: '',
    twitterUrl: '',
    tiktokUrl: '',
    snapchatUrl: '',
    youtubeUrl: '',
    businessHours: EMPTY_WEEK.map((h) => ({ ...h })),
    holidays: [],
    mapEmbedUrl: '',
  };
}

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [FormsModule, JsonPipe],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.scss',
})
export class AdminSettingsComponent {
  private readonly bizService = inject(BusinessInfoService);

  form    = signal<FormState>(makeEmptyBusinessInfo());
  loading = signal<boolean>(true);
  saving  = signal<boolean>(false);
  saved   = signal<boolean>(false);
  error   = signal<string>('');

  /** New-holiday input state */
  newHolidayDate  = signal<string>('');
  newHolidayLabel = signal<string>('');

  readonly hasHolidays = computed(() => this.form().holidays.length > 0);

  /** Where the current in-memory form was loaded from. */
  readonly source = this.bizService.source;

  /** Raw Firestore doc — populated by the "Verify saved data" diagnostic button. */
  readonly rawFirestoreData  = signal<Partial<BusinessInfo> | null | undefined>(undefined);
  readonly rawFirestoreError = signal<string>('');

  constructor() {
    this.bizService.get().subscribe({
      next: (info) => {
        console.info('[AdminSettings] received info', info, 'source=', this.source());
        this.form.set(this.normalize(info));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[AdminSettings] load failed', err);
        this.error.set('Failed to load settings.');
        this.loading.set(false);
      },
    });
  }

  // ── Field setters ──────────────────────────────────────────────────────────

  setField<K extends keyof FormState>(key: K, value: FormState[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
    this.saved.set(false);
  }

  setHours(index: number, patch: Partial<BusinessHours>): void {
    this.form.update((f) => {
      const next = [...f.businessHours];
      next[index] = { ...next[index], ...patch };
      return { ...f, businessHours: next };
    });
    this.saved.set(false);
  }

  /** Convert "HH:MM" (24h) to a human-readable "H:MM AM/PM" label. */
  fmt24(hhmm: string | undefined): string {
    if (!hhmm) return '';
    const m = hhmm.match(/^(\d{2}):(\d{2})$/);
    if (!m) return '';
    const h24 = Number(m[1]);
    const min = Number(m[2]);
    const period = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    return `${h12}:${min.toString().padStart(2, '0')} ${period}`;
  }

  // ── Holidays ──────────────────────────────────────────────────────────────

  addHoliday(): void {
    const date  = this.newHolidayDate().trim();
    const label = this.newHolidayLabel().trim();
    if (!date || !label) {
      this.error.set('Holiday date and label are required.');
      return;
    }
    this.error.set('');
    const holiday: Holiday = { date, label };
    this.form.update((f) => ({
      ...f,
      holidays: [...f.holidays, holiday].sort((a, b) => a.date.localeCompare(b.date)),
    }));
    this.newHolidayDate.set('');
    this.newHolidayLabel.set('');
    this.saved.set(false);
  }

  removeHoliday(date: string): void {
    this.form.update((f) => ({
      ...f,
      holidays: f.holidays.filter((h) => h.date !== date),
    }));
    this.saved.set(false);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  async save(): Promise<void> {
    const data = this.form();
    if (!data.name || !data.phone || !data.email) {
      this.error.set('Name, phone and email are required.');
      return;
    }
    this.error.set('');
    this.saving.set(true);
    try {
      await this.bizService.save(data);
      this.saved.set(true);
      // Refresh the raw-doc peek so the admin can see the just-persisted state.
      this.peekFirestore().catch(() => { /* non-fatal */ });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.error.set(`Save failed: ${msg}`);
    } finally {
      this.saving.set(false);
    }
  }

  /**
   * Diagnostic: fetch the raw config/business document straight from Firestore
   * (bypassing the shareReplay-cached observable) and expose it in the UI so
   * the admin can verify that a save actually persisted the fields they typed.
   */
  async peekFirestore(): Promise<void> {
    this.rawFirestoreError.set('');
    try {
      const raw = await this.bizService.peekRaw();
      this.rawFirestoreData.set(raw);
      console.info('[AdminSettings] peekFirestore →', raw);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.rawFirestoreError.set(msg);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Build the form state from the (possibly null) service payload. When
   * the Firestore doc is missing, we render an empty form so the admin
   * can create the very first business profile from scratch.
   */
  private normalize(info: BusinessInfo | null): FormState {
    if (!info) return makeEmptyBusinessInfo();
    return {
      ...info,
      businessHours: info.businessHours?.length
        ? info.businessHours.map((h) => ({ ...h }))
        : EMPTY_WEEK.map((h) => ({ ...h })),
      holidays: (info.holidays ?? []).map((h) => ({ ...h })),
    };
  }
}
