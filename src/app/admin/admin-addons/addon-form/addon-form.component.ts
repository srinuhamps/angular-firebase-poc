import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { ServiceAddonsService } from '../../../core/services/service-addons.service';
import { ServicesService } from '../../../core/services/services.service';
import { ServiceAddon } from '../../../core/models/service-addon.model';
import { HairService } from '../../../core/models/hair-service.model';

type FormData = Omit<ServiceAddon, 'id'>;

const EMPTY_FORM: FormData = {
  name: '',
  priceDelta: 0,
  durationDelta: 0,
  appliesToAll: true,
  appliesToServiceIds: [],
  isActive: true,
  sortOrder: 0,
};

@Component({
  selector: 'app-addon-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './addon-form.component.html',
  styleUrl: './addon-form.component.scss',
})
export class AddonFormComponent implements OnInit {
  private readonly addonsSvc  = inject(ServiceAddonsService);
  private readonly svcService = inject(ServicesService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);

  private originalForm: FormData = { ...EMPTY_FORM };

  readonly editId           = signal<string | null>(null);
  readonly form             = signal<FormData>({ ...EMPTY_FORM });
  readonly saving           = signal<boolean>(false);
  readonly error            = signal<string>('');
  readonly services         = signal<HairService[]>([]);
  readonly showCancelDialog = signal(false);

  isDirty(): boolean {
    return JSON.stringify(this.form()) !== JSON.stringify(this.originalForm);
  }

  cancel(): void {
    if (this.isDirty()) {
      this.showCancelDialog.set(true);
    } else {
      this.router.navigate(['/admin/addons']);
    }
  }

  confirmCancel(): void {
    this.router.navigate(['/admin/addons']);
  }

  dismissDialog(): void {
    this.showCancelDialog.set(false);
  }

  ngOnInit(): void {
    // Load services for the "applies to" picker regardless of new vs. edit.
    this.svcService.getAll().subscribe((s) => this.services.set(s));

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      this.addonsSvc.getAll().pipe(
        map((list) => list.find((a) => a.id === id))
      ).subscribe((addon) => {
        if (addon) {
          const { id: _id, ...data } = addon;
          this.form.set({ ...data });
          this.originalForm = { ...data };
        }
      });
    }
  }

  async save(): Promise<void> {
    const data = this.form();
    if (!data.name.trim()) {
      this.error.set('Name is required.');
      return;
    }
    if (!data.appliesToAll && data.appliesToServiceIds.length === 0) {
      this.error.set('Pick at least one service, or check "Applies to all services".');
      return;
    }
    this.error.set('');
    this.saving.set(true);
    try {
      // Clean payload: if appliesToAll, we can drop the explicit list to avoid
      // stale IDs sticking around; keep an empty array for schema consistency.
      const payload: FormData = {
        ...data,
        name: data.name.trim(),
        appliesToServiceIds: data.appliesToAll ? [] : data.appliesToServiceIds,
      };
      const id = this.editId();
      if (id) {
        await this.addonsSvc.update(id, payload);
      } else {
        await this.addonsSvc.add(payload);
      }
      this.router.navigate(['/admin/addons']);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Surface the raw Firestore/rules error so "permission-denied" or a
      // failed schema check is actionable instead of a generic message.
      this.error.set('Save failed: ' + msg);
      console.error('[AddonForm] save failed', err);
    } finally {
      this.saving.set(false);
    }
  }

  setField<K extends keyof FormData>(key: K, value: FormData[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  isServiceChecked(id: string): boolean {
    return this.form().appliesToServiceIds.includes(id);
  }

  toggleService(id: string, checked: boolean): void {
    this.form.update((f) => {
      const next = checked
        ? (f.appliesToServiceIds.includes(id) ? f.appliesToServiceIds : [...f.appliesToServiceIds, id])
        : f.appliesToServiceIds.filter((x) => x !== id);
      return { ...f, appliesToServiceIds: next };
    });
  }
}
