import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ServicesService } from '../../../core/services/services.service';
import { ServiceAddonsService } from '../../../core/services/service-addons.service';
import {
  HairService,
  SERVICE_CATEGORIES,
} from '../../../core/models/hair-service.model';
import { ServiceAddon } from '../../../core/models/service-addon.model';
import { MediaPickerComponent } from '../../media-picker/media-picker.component';
import { MultiMediaPickerComponent } from '../../multi-media-picker/multi-media-picker.component';

type FormData = Omit<HairService, 'id'>;

const EMPTY_FORM: FormData = {
  name: '',
  category: 'box-braids',
  shortDescription: '',
  description: '',
  price: 0,
  duration: 60,
  imageUrl: '',
  mediaUrls: [],
  videoUrl: '',
  isAvailable: true,
  isFeatured: false,
  bookingEnabled: true,
  tags: [],
  sortOrder: 0,
  addonIds: [],
};

@Component({
  selector: 'app-service-form',
  standalone: true,
  imports: [FormsModule, RouterLink, MediaPickerComponent, MultiMediaPickerComponent],
  templateUrl: './service-form.component.html',
  styleUrl: './service-form.component.scss',
})
export class ServiceFormComponent implements OnInit {
  private readonly svcService    = inject(ServicesService);
  private readonly addonsSvc     = inject(ServiceAddonsService);
  private readonly route         = inject(ActivatedRoute);
  private readonly router        = inject(Router);

  private originalForm: FormData = { ...EMPTY_FORM };
  private originalTagsRaw = '';

  editId           = signal<string | null>(null);
  form             = signal<FormData>({ ...EMPTY_FORM });
  saving           = signal<boolean>(false);
  error            = signal<string>('');
  tagsRaw          = signal<string>('');
  showCancelDialog = signal(false);

  /** All active add-ons loaded from Firestore. Split into globals + pickable. */
  readonly allAddons = signal<ServiceAddon[]>([]);

  /** Add-ons that apply to every service automatically — shown as an info list. */
  readonly globalAddons = computed<ServiceAddon[]>(() =>
    this.allAddons()
      .filter((a) => a.isActive && a.appliesToAll)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  /** Add-ons the admin can opt this service into via the checklist. */
  readonly pickableAddons = computed<ServiceAddon[]>(() =>
    this.allAddons()
      .filter((a) => a.isActive && !a.appliesToAll)
      .sort((a, b) => a.name.localeCompare(b.name))
  );

  /** How many of the pickable add-ons are currently checked for this service. */
  readonly selectedAddonCount = computed<number>(() => {
    const ids = new Set(this.form().addonIds ?? []);
    return this.pickableAddons().filter((a) => ids.has(a.id)).length;
  });

  /** True once every pickable add-on is checked (drives the "Select All" checkbox state). */
  readonly allAddonsSelected = computed<boolean>(() => {
    const pickable = this.pickableAddons();
    return pickable.length > 0 && this.selectedAddonCount() === pickable.length;
  });

  /** Categories shown in the dropdown. */
  readonly categories = SERVICE_CATEGORIES;

  isDirty(): boolean {
    return (
      JSON.stringify(this.form()) !== JSON.stringify(this.originalForm) ||
      this.tagsRaw() !== this.originalTagsRaw
    );
  }

  cancel(): void {
    if (this.isDirty()) {
      this.showCancelDialog.set(true);
    } else {
      this.router.navigate(['/admin/services']);
    }
  }

  confirmCancel(): void {
    this.router.navigate(['/admin/services']);
  }

  dismissDialog(): void {
    this.showCancelDialog.set(false);
  }

  async ngOnInit(): Promise<void> {
    // Fire-and-forget: pull add-ons so the checklist can render.
    this.addonsSvc.getAll().subscribe((a) => this.allAddons.set(a));

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.editId.set(id);
    const list = await firstValueFrom(this.svcService.getAll());
    const svc = list.find((s) => s.id === id);
    if (!svc) return;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...data } = svc;
    const normalized: FormData = {
      ...EMPTY_FORM,
      ...data,
      // Firestore may return this as undefined for pre-existing documents.
      addonIds: Array.isArray(data.addonIds) ? [...data.addonIds] : [],
    };
    this.form.set(normalized);
    this.tagsRaw.set(svc.tags.join(', '));
    this.originalForm    = { ...normalized };
    this.originalTagsRaw = svc.tags.join(', ');
  }

  async save(): Promise<void> {
    const data = this.form();
    if (!data.name) {
      this.error.set('Name is required.');
      return;
    }
    if (!data.shortDescription) {
      this.error.set('Short description is required.');
      return;
    }

    this.error.set('');
    this.saving.set(true);
    const persist: FormData = {
      ...data,
      tags: this.tagsRaw().split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      const id = this.editId();
      if (id) {
        await this.svcService.update(id, persist);
      } else {
        await this.svcService.add(persist);
      }
      this.router.navigate(['/admin/services']);
    } catch {
      this.error.set('Save failed. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  setField<K extends keyof FormData>(key: K, value: FormData[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  isAddonChecked(id: string): boolean {
    return (this.form().addonIds ?? []).includes(id);
  }

  toggleAddon(id: string, checked: boolean): void {
    this.form.update((f) => {
      const current = f.addonIds ?? [];
      const next = checked
        ? (current.includes(id) ? current : [...current, id])
        : current.filter((x) => x !== id);
      return { ...f, addonIds: next };
    });
  }

  /** Selects or clears every pickable add-on in one click. */
  toggleSelectAllAddons(checked: boolean): void {
    this.form.update((f) => {
      const pickableIds = this.pickableAddons().map((a) => a.id);
      const current = f.addonIds ?? [];
      const next = checked
        ? Array.from(new Set([...current, ...pickableIds]))
        : current.filter((id) => !pickableIds.includes(id));
      return { ...f, addonIds: next };
    });
  }

  /**
   * Human-readable combined time + price delta for an add-on, e.g.
   * `+45 minutes @ $65.00` or `-2 hours 30 minutes @ $200.00`. Returns an
   * empty string when the add-on changes neither time nor price.
   */
  formatAddonDelta(a: ServiceAddon): string {
    const { priceDelta, durationDelta } = a;
    if (priceDelta === 0 && durationDelta === 0) return '';

    const sign = priceDelta < 0 || durationDelta < 0 ? '-' : '+';
    const priceText = `$${Math.abs(priceDelta).toFixed(2)}`;

    if (durationDelta === 0) return `${sign}${priceText}`;

    const absMin = Math.abs(durationDelta);
    const h = Math.floor(absMin / 60);
    const m = absMin % 60;
    const plural = (n: number, unit: string): string => `${n} ${unit}${n === 1 ? '' : 's'}`;
    const durationText =
      h > 0 && m > 0 ? `${plural(h, 'hour')} ${plural(m, 'minute')}`
      : h > 0        ? plural(h, 'hour')
      :                plural(m, 'minute');

    return `${sign}${durationText} @ ${priceText}`;
  }
}
