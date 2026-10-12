import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Firestore,
  collection,
  doc,
  writeBatch,
} from '@angular/fire/firestore';
import { ServicesService } from '../../core/services/services.service';
import { ServiceAddonsService } from '../../core/services/service-addons.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import {
  HairService,
  ServiceCategory,
  SERVICE_CATEGORIES,
  labelForCategory,
} from '../../core/models/hair-service.model';
import { ServiceAddon } from '../../core/models/service-addon.model';

// ── Bulk-import parser types ────────────────────────────────────────────────

interface ParsedService extends Omit<HairService, 'id'> {
  /** Errors specific to this row — surfaced in the preview table. */
  _errors: string[];
  /**
   * Add-on names (case-insensitive) to link, resolved to real add-on IDs at
   * import time — lets a paste reference add-ons by name instead of needing
   * their (not-yet-known) Firestore IDs. Resolved against add-ons already in
   * Firestore plus any `addons` included in the same paste.
   */
  _addonNames: string[];
}
interface ParsedAddon extends Omit<ServiceAddon, 'id'> {
  _errors: string[];
}

interface ParseResult {
  services: ParsedService[];
  addons:   ParsedAddon[];
  /** Top-level errors (bad JSON, wrong root shape, empty payload). */
  errors:   string[];
}

const SAMPLE_JSON = `{
  "services": [
    {
      "name": "Small Knotless Braids",
      "category": "knotless-braids",
      "price": 220,
      "duration": 360,
      "shortDescription": "Tension-free small knotless box braids.",
      "isFeatured": true,
      "addonNames": ["Extra Length"]
    }
  ],
  "addons": [
    {
      "name": "Extra Length",
      "priceDelta": 25,
      "durationDelta": 30,
      "appliesToAll": true
    }
  ]
}`;

@Component({
  selector: 'app-admin-services',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './admin-services.component.html',
  styleUrl: './admin-services.component.scss',
})
export class AdminServicesComponent {
  private readonly svcService   = inject(ServicesService);
  private readonly addonsSvc    = inject(ServiceAddonsService);
  private readonly confirmSvc   = inject(ConfirmService);
  private readonly toast        = inject(ToastService);
  private readonly firestore    = inject(Firestore);

  services      = signal<HairService[]>([]);
  loading       = signal<boolean>(true);
  deleting      = signal<string | null>(null);
  bulkUpdating  = signal<boolean>(false);

  /** Add-ons already saved in Firestore — used to resolve `addonNames` during import. */
  readonly existingAddons = signal<ServiceAddon[]>([]);
  bulkDeleting  = signal<boolean>(false);

  /** IDs of services checked in the list for multi-select delete. */
  readonly selectedIds = signal<Set<string>>(new Set());

  /** Exposed to the template so category slugs render as friendly labels. */
  readonly categoryLabel = labelForCategory;
  /** Exposed to the template for the category filter dropdown. */
  readonly allCategories = SERVICE_CATEGORIES;

  // ── Column filters ─────────────────────────────────────────────────

  readonly filterName        = signal<string>('');
  readonly filterCategory    = signal<string>('all');
  readonly filterMinPrice    = signal<string>('');   // string so blank stays blank
  readonly filterMinDuration = signal<string>('');   // in minutes
  readonly filterAvailable   = signal<'all' | 'yes' | 'no'>('all');
  readonly filterFeatured    = signal<'all' | 'yes' | 'no'>('all');

  /** Services after the column filters are applied. */
  readonly filteredServices = computed<HairService[]>(() => {
    const name  = this.filterName().trim().toLowerCase();
    const cat   = this.filterCategory();
    const minP  = this.filterMinPrice().trim() === '' ? null : Number(this.filterMinPrice());
    const minD  = this.filterMinDuration().trim() === '' ? null : Number(this.filterMinDuration());
    const avail = this.filterAvailable();
    const feat  = this.filterFeatured();

    return this.services().filter((s) => {
      if (name && !s.name.toLowerCase().includes(name)) return false;
      if (cat !== 'all' && s.category !== cat) return false;
      if (minP !== null && !Number.isNaN(minP) && s.price < minP) return false;
      if (minD !== null && !Number.isNaN(minD) && s.duration < minD) return false;
      if (avail === 'yes' && !s.isAvailable) return false;
      if (avail === 'no'  &&  s.isAvailable) return false;
      if (feat  === 'yes' && !s.isFeatured)  return false;
      if (feat  === 'no'  &&  s.isFeatured)  return false;
      return true;
    });
  });

  /** True when any filter is set — controls the "Reset" button visibility. */
  readonly hasActiveFilters = computed<boolean>(() =>
    this.filterName() !== ''
    || this.filterCategory()    !== 'all'
    || this.filterMinPrice()    !== ''
    || this.filterMinDuration() !== ''
    || this.filterAvailable()   !== 'all'
    || this.filterFeatured()    !== 'all'
  );

  resetFilters(): void {
    this.filterName.set('');
    this.filterCategory.set('all');
    this.filterMinPrice.set('');
    this.filterMinDuration.set('');
    this.filterAvailable.set('all');
    this.filterFeatured.set('all');
  }

  // ── Multi-select ───────────────────────────────────────────────────────

  /** How many services are currently checked. */
  readonly selectedCount = computed<number>(() => this.selectedIds().size);

  /** True when every currently-filtered row is checked (drives the header checkbox). */
  readonly allFilteredSelected = computed<boolean>(() => {
    const filtered = this.filteredServices();
    if (filtered.length === 0) return false;
    const ids = this.selectedIds();
    return filtered.every((s) => ids.has(s.id));
  });

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelect(id: string, checked: boolean): void {
    this.selectedIds.update((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  /** Checks/unchecks every row currently visible under the active filters. */
  toggleSelectAllFiltered(checked: boolean): void {
    const filteredIds = this.filteredServices().map((s) => s.id);
    this.selectedIds.update((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of filteredIds) next.add(id);
      } else {
        for (const id of filteredIds) next.delete(id);
      }
      return next;
    });
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  /** Bulk-deletes every checked service, chunked to respect the 500-write Firestore batch cap. */
  async deleteSelected(): Promise<void> {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    const ok = await this.confirmSvc.ask({
      title:       `Delete ${ids.length} service${ids.length === 1 ? '' : 's'}?`,
      message:     `This will permanently remove ${ids.length} selected service${ids.length === 1 ? '' : 's'}. This cannot be undone.`,
      confirmText: 'Delete',
      danger:      true,
    });
    if (!ok) return;

    this.bulkDeleting.set(true);
    try {
      const CHUNK_SIZE = 450;
      for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const batch = writeBatch(this.firestore);
        for (const id of ids.slice(i, i + CHUNK_SIZE)) {
          batch.delete(doc(this.firestore, 'services', id));
        }
        await batch.commit();
      }
      this.toast.success(`Deleted ${ids.length} service${ids.length === 1 ? '' : 's'}.`);
      this.clearSelection();
      this.load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Bulk delete failed: ' + msg);
    } finally {
      this.bulkDeleting.set(false);
    }
  }

  /**
   * Render a duration in minutes as a compact `Xh Ym` label with the raw
   * minute count in parentheses (e.g. `6h 30m (390 min)`). Values below an
   * hour render as `Xm` only.
   */
  formatDuration(min: number): string {
    if (!Number.isFinite(min) || min <= 0) return '—';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    const hm = m === 0 ? `${h}h` : `${h}h ${m}m`;
    return `${hm} (${min} min)`;
  }

  // ── Bulk-import state ────────────────────────────────────────────────────

  readonly showImport = signal<boolean>(false);
  readonly rawJson    = signal<string>('');
  readonly parsed     = signal<ParseResult | null>(null);
  readonly importing  = signal<boolean>(false);
  readonly sampleJson = SAMPLE_JSON;

  /** Valid category slugs — used by the parser to flag typos. */
  private readonly validCategories = new Set<string>(SERVICE_CATEGORIES.map((c) => c.value));

  readonly totalImportRows = computed(() => {
    const p = this.parsed();
    if (!p) return 0;
    return p.services.length + p.addons.length;
  });
  readonly totalImportErrors = computed(() => {
    const p = this.parsed();
    if (!p) return 0;
    return p.errors.length
      + p.services.reduce((acc, s) => acc + s._errors.length, 0)
      + p.addons.reduce((acc, a) => acc + a._errors.length, 0);
  });
  readonly canImport = computed(() =>
    !!this.parsed() && this.totalImportRows() > 0 && this.totalImportErrors() === 0 && !this.importing()
  );

  constructor() {
    this.load();
    this.addonsSvc.getAll().subscribe((a) => this.existingAddons.set(a));
  }

  private load(): void {
    this.loading.set(true);
    this.svcService.getAll().subscribe((s) => {
      // Sort by sortOrder, then name so the table has a stable order.
      const sorted = [...s].sort((a, b) =>
        (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name)
      );
      this.services.set(sorted);
      this.loading.set(false);
    });
  }

  async toggleAvailable(svc: HairService): Promise<void> {
    await this.svcService.update(svc.id, { isAvailable: !svc.isAvailable });
    this.load();
  }

  async delete(id: string): Promise<void> {
    const svc = this.services().find((s) => s.id === id);
    if (!svc) return;

    const ok = await this.confirmSvc.ask({
      title:       'Delete service?',
      message:     `“${svc.name}” will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete',
      danger:      true,
    });
    if (!ok) return;
    this.deleting.set(id);
    try {
      await this.svcService.delete(id);
      this.toast.success(`Deleted “${svc.name}”.`);
      this.load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Could not delete: ' + msg);
    } finally {
      this.deleting.set(null);
    }
  }

  /**
   * Sets `isAvailable`, `isFeatured`, and `bookingEnabled` to `false` on every
   * service in one shot. Useful for taking the whole menu offline (e.g. while
   * re-pricing) without deleting anything. Reversible one row at a time via
   * the Available/Featured toggles and Edit form.
   */
  async disableAllServices(): Promise<void> {
    const all = this.services();
    if (all.length === 0) return;

    const ok = await this.confirmSvc.ask({
      title:       'Disable all services?',
      message:
        `All ${all.length} services will be marked unavailable, unfeatured, ` +
        `and booking-disabled. Nothing is deleted \u2014 you can re-enable ` +
        `individual services afterward from this list or their edit page.`,
      confirmText: 'Disable All',
      danger:      true,
    });
    if (!ok) return;

    this.bulkUpdating.set(true);
    try {
      // Firestore batches cap at 500 writes; chunk defensively even though
      // the current catalog (127 services) is well under that limit.
      const CHUNK_SIZE = 450;
      for (let i = 0; i < all.length; i += CHUNK_SIZE) {
        const batch = writeBatch(this.firestore);
        for (const svc of all.slice(i, i + CHUNK_SIZE)) {
          batch.update(doc(this.firestore, 'services', svc.id), {
            isAvailable:    false,
            isFeatured:     false,
            bookingEnabled: false,
          });
        }
        await batch.commit();
      }
      this.toast.success(`Disabled all ${all.length} services.`);
      this.load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Bulk disable failed: ' + msg);
    } finally {
      this.bulkUpdating.set(false);
    }
  }

  // ── Bulk-import actions ──────────────────────────────────────────────────

  toggleImport(): void {
    this.showImport.update((v) => !v);
    // Reset preview when the panel is hidden so re-opening feels fresh.
    if (!this.showImport()) {
      this.parsed.set(null);
    }
  }

  insertSampleJson(): void {
    this.rawJson.set(SAMPLE_JSON);
    this.parsed.set(null);
  }

  clearImport(): void {
    this.rawJson.set('');
    this.parsed.set(null);
  }

  parseImport(): void {
    this.parsed.set(this.parseInput(this.rawJson()));
  }

  async runImport(): Promise<void> {
    const p = this.parsed();
    if (!p || !this.canImport()) return;

    const ok = await this.confirmSvc.ask({
      title:       'Import to Firestore?',
      message:
        `Add ${p.services.length} service${p.services.length === 1 ? '' : 's'}` +
        ` and ${p.addons.length} add-on${p.addons.length === 1 ? '' : 's'} to Firestore. ` +
        `Rows have to be deleted individually if you change your mind.`,
      confirmText: 'Import',
      danger:      false,
    });
    if (!ok) return;

    this.importing.set(true);
    try {
      const batch = writeBatch(this.firestore);
      const servicesCol = collection(this.firestore, 'services');
      const addonsCol   = collection(this.firestore, 'serviceAddons');

      // Resolve `addonNames` -> real Firestore IDs. Start from add-ons already
      // saved, then let add-ons created in this same paste take priority.
      const addonIdByName = new Map<string, string>();
      for (const a of this.existingAddons()) {
        addonIdByName.set(a.name.trim().toLowerCase(), a.id);
      }
      let skippedAddons = 0;
      for (const a of p.addons) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _errors, ...clean } = a;
        const key = a.name.trim().toLowerCase();
        // Don't create a duplicate doc if an add-on with this exact name
        // already exists in Firestore — just reuse its ID.
        if (addonIdByName.has(key)) {
          skippedAddons++;
          continue;
        }
        const ref = doc(addonsCol);
        batch.set(ref, clean);
        addonIdByName.set(key, ref.id);
      }

      // Strip our private fields before writing, resolving addonNames -> addonIds.
      for (const s of p.services) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { _errors, _addonNames, ...clean } = s;
        const linkedIds = _addonNames
          .map((n) => addonIdByName.get(n.trim().toLowerCase()))
          .filter((id): id is string => !!id);
        const addonIds = Array.from(new Set([...(clean.addonIds ?? []), ...linkedIds]));
        batch.set(doc(servicesCol), { ...clean, addonIds });
      }

      await batch.commit();
      this.toast.success(
        `Imported ${p.services.length} service${p.services.length === 1 ? '' : 's'}` +
        ` and ${p.addons.length - skippedAddons} add-on${p.addons.length - skippedAddons === 1 ? '' : 's'}` +
        (skippedAddons ? ` (${skippedAddons} skipped, already existed).` : '.')
      );
      this.clearImport();
      this.showImport.set(false);
      this.load();
      // Refresh so the next import in this session can resolve addonNames
      // against add-ons that were just created.
      this.addonsSvc.getAll().subscribe((a) => this.existingAddons.set(a));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Import failed: ' + msg);
    } finally {
      this.importing.set(false);
    }
  }

  // ── Parser ────────────────────────────────────────────────────────────────

  private parseInput(text: string): ParseResult {
    const result: ParseResult = { services: [], addons: [], errors: [] };
    const trimmed = text.trim();
    if (!trimmed) {
      result.errors.push('Paste some JSON above, then click Parse & Preview.');
      return result;
    }

    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      result.errors.push('JSON is invalid: ' + msg);
      return result;
    }

    if (typeof json !== 'object' || json === null || Array.isArray(json)) {
      result.errors.push('Root must be an object with a "services" and/or "addons" array.');
      return result;
    }

    const root = json as { services?: unknown; addons?: unknown };
    const rawServices = Array.isArray(root.services) ? root.services : [];
    const rawAddons   = Array.isArray(root.addons)   ? root.addons   : [];

    if (rawServices.length === 0 && rawAddons.length === 0) {
      result.errors.push('Nothing to import — provide a non-empty "services" or "addons" array.');
    }

    // Track duplicates within the paste so the admin catches typos before writing.
    const seenServiceNames = new Set<string>();
    const seenAddonNames   = new Set<string>();

    // Add-on names a service's `addonNames` can resolve against: anything
    // already saved in Firestore, plus anything included in this same paste.
    const availableAddonNames = new Set<string>(
      this.existingAddons().map((a) => a.name.trim().toLowerCase())
    );
    for (const raw of rawAddons) {
      if (raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>)['name'] === 'string') {
        availableAddonNames.add(((raw as Record<string, unknown>)['name'] as string).trim().toLowerCase());
      }
    }

    rawServices.forEach((raw, idx) => {
      result.services.push(this.parseServiceRow(raw, idx, seenServiceNames, availableAddonNames));
    });
    rawAddons.forEach((raw, idx) => {
      result.addons.push(this.parseAddonRow(raw, idx, seenAddonNames));
    });
    return result;
  }

  private parseServiceRow(
    raw: unknown,
    idx: number,
    seen: Set<string>,
    availableAddonNames: Set<string>,
  ): ParsedService {
    const errors: string[] = [];
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};

    const name = typeof r['name'] === 'string' ? (r['name'] as string).trim() : '';
    if (!name) errors.push('name is required');
    if (name) {
      const key = name.toLowerCase();
      if (seen.has(key)) errors.push('duplicate name in this paste');
      seen.add(key);
    }

    const category = typeof r['category'] === 'string' ? (r['category'] as string).trim() : '';
    if (!category) errors.push('category is required');
    else if (!this.validCategories.has(category)) errors.push(`unknown category "${category}"`);

    const price    = this.numOrNaN(r['price']);
    const duration = this.numOrNaN(r['duration']);
    if (Number.isNaN(price) || price < 0)       errors.push('price must be a non-negative number');
    if (Number.isNaN(duration) || duration < 0) errors.push('duration must be a non-negative number of minutes');

    const shortDescription = typeof r['shortDescription'] === 'string' ? (r['shortDescription'] as string) : '';
    if (!shortDescription.trim()) errors.push('shortDescription is required');

    const description    = typeof r['description']    === 'string'  ? r['description']    as string  : '';
    const imageUrl       = typeof r['imageUrl']       === 'string'  ? r['imageUrl']       as string  : '';
    const isAvailable    = typeof r['isAvailable']    === 'boolean' ? r['isAvailable']    as boolean : true;
    const isFeatured     = typeof r['isFeatured']     === 'boolean' ? r['isFeatured']     as boolean : false;
    const bookingEnabled = typeof r['bookingEnabled'] === 'boolean' ? r['bookingEnabled'] as boolean : true;
    const tags = Array.isArray(r['tags'])
      ? (r['tags'] as unknown[]).filter((t): t is string => typeof t === 'string')
      : [];
    const addonIds = Array.isArray(r['addonIds'])
      ? (r['addonIds'] as unknown[]).filter((v): v is string => typeof v === 'string')
      : [];
    const addonNames = Array.isArray(r['addonNames'])
      ? (r['addonNames'] as unknown[])
          .filter((v): v is string => typeof v === 'string')
          .map((v) => v.trim())
          .filter(Boolean)
      : [];
    const unknownAddonNames = addonNames.filter((n) => !availableAddonNames.has(n.toLowerCase()));
    if (unknownAddonNames.length > 0) {
      errors.push(`unknown add-on(s): ${unknownAddonNames.join(', ')}`);
    }
    const sortOrder = this.numOrDefault(r['sortOrder'], idx);

    return {
      name,
      // Fall back to a safe placeholder when invalid so the row still renders in the preview.
      category: (this.validCategories.has(category) ? category : 'consultation') as ServiceCategory,
      shortDescription,
      description,
      price:    Number.isNaN(price)    ? 0 : price,
      duration: Number.isNaN(duration) ? 0 : duration,
      imageUrl,
      isAvailable,
      isFeatured,
      bookingEnabled,
      tags,
      sortOrder,
      addonIds,
      _addonNames: addonNames,
      _errors: errors,
    };
  }

  private parseAddonRow(raw: unknown, idx: number, seen: Set<string>): ParsedAddon {
    const errors: string[] = [];
    const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};

    const name = typeof r['name'] === 'string' ? (r['name'] as string).trim() : '';
    if (!name) errors.push('name is required');
    if (name) {
      const key = name.toLowerCase();
      if (seen.has(key)) errors.push('duplicate name in this paste');
      seen.add(key);
    }

    const priceDelta    = this.numOrNaN(r['priceDelta']);
    const durationDelta = this.numOrNaN(r['durationDelta']);
    if (Number.isNaN(priceDelta))    errors.push('priceDelta must be a number (can be negative)');
    if (Number.isNaN(durationDelta)) errors.push('durationDelta must be a number in minutes (can be negative)');

    const appliesToAll = typeof r['appliesToAll'] === 'boolean' ? r['appliesToAll'] as boolean : true;
    const appliesToServiceIds = Array.isArray(r['appliesToServiceIds'])
      ? (r['appliesToServiceIds'] as unknown[]).filter((value): value is string => typeof value === 'string')
      : [];
    const isActive  = typeof r['isActive'] === 'boolean' ? r['isActive'] as boolean : true;
    const sortOrder = this.numOrDefault(r['sortOrder'], idx);

    return {
      name,
      priceDelta:    Number.isNaN(priceDelta)    ? 0 : priceDelta,
      durationDelta: Number.isNaN(durationDelta) ? 0 : durationDelta,
      appliesToAll,
      appliesToServiceIds,
      isActive,
      sortOrder,
      _errors: errors,
    };
  }

  private numOrNaN(v: unknown): number {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') {
      const n = Number(v);
      return Number.isNaN(n) ? NaN : n;
    }
    return NaN;
  }

  private numOrDefault(v: unknown, fallback: number): number {
    const n = this.numOrNaN(v);
    return Number.isNaN(n) ? fallback : n;
  }
}
