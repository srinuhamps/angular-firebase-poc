import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BusinessInfoService } from '../../core/services/business-info.service';
import {
  BusinessInfo,
  BusinessHours,
  Holiday,
} from '../../core/models/business-info.model';
import { MOCK_BUSINESS_INFO } from '../../data/mock/business-info.mock';

type FormState = BusinessInfo;

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.scss',
})
export class AdminSettingsComponent {
  private readonly bizService = inject(BusinessInfoService);

  form    = signal<FormState>(this.cloneEmpty());
  loading = signal<boolean>(true);
  saving  = signal<boolean>(false);
  saved   = signal<boolean>(false);
  error   = signal<string>('');

  /** New-holiday input state */
  newHolidayDate  = signal<string>('');
  newHolidayLabel = signal<string>('');

  readonly hasHolidays = computed(() => this.form().holidays.length > 0);

  constructor() {
    this.bizService.get().subscribe({
      next: (info) => {
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.error.set(`Save failed: ${msg}`);
    } finally {
      this.saving.set(false);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private normalize(info: BusinessInfo): FormState {
    return {
      ...info,
      businessHours: info.businessHours?.length
        ? info.businessHours.map((h) => ({ ...h }))
        : MOCK_BUSINESS_INFO.businessHours.map((h) => ({ ...h })),
      holidays: (info.holidays ?? []).map((h) => ({ ...h })),
    };
  }

  private cloneEmpty(): FormState {
    return this.normalize(MOCK_BUSINESS_INFO);
  }
}
