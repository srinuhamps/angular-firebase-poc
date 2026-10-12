import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServiceAddonsService } from '../../core/services/service-addons.service';
import { ServicesService } from '../../core/services/services.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { ServiceAddon } from '../../core/models/service-addon.model';
import { HairService } from '../../core/models/hair-service.model';

@Component({
  selector: 'app-admin-addons',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-addons.component.html',
  styleUrl: './admin-addons.component.scss',
})
export class AdminAddonsComponent {
  private readonly addonsSvc  = inject(ServiceAddonsService);
  private readonly svcService = inject(ServicesService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast      = inject(ToastService);

  readonly addons   = signal<ServiceAddon[]>([]);
  readonly services = signal<HairService[]>([]);
  readonly loading  = signal<boolean>(true);
  readonly deleting = signal<string | null>(null);

  /** Lookup: serviceId → serviceName, used to render `appliesToServiceIds`. */
  readonly serviceNameById = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of this.services()) map[s.id] = s.name;
    return map;
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    // Fire both requests in parallel; add-ons are the main content, services
    // are just for the "Applies to" label lookup.
    this.svcService.getAll().subscribe((s) => this.services.set(s));
    this.addonsSvc.getAll().subscribe((a) => {
      this.addons.set(a);
      this.loading.set(false);
    });
  }

  async toggleActive(a: ServiceAddon): Promise<void> {
    await this.addonsSvc.update(a.id, { isActive: !a.isActive });
    this.load();
  }

  async delete(id: string): Promise<void> {
    const a = this.addons().find((x) => x.id === id);
    const ok = await this.confirmSvc.ask({
      title:       'Delete add-on?',
      message:     `“${a?.name ?? 'This add-on'}” will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete',
      danger:      true,
    });
    if (!ok) return;
    this.deleting.set(id);
    try {
      await this.addonsSvc.delete(id);
      this.toast.success(`Deleted “${a?.name ?? 'add-on'}”.`);
      this.load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Could not delete add-on: ' + msg);
    } finally {
      this.deleting.set(null);
    }
  }

  formatPriceDelta(n: number): string {
    const sign = n >= 0 ? '+' : '−';
    const abs = Math.abs(n).toFixed(2);
    return `${sign}$${abs}`;
  }

  formatDurationDelta(min: number): string {
    if (min === 0) return '0 min';
    const sign = min >= 0 ? '+' : '−';
    const abs = Math.abs(min);
    if (abs < 60) return `${sign}${abs} min`;
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m === 0 ? `${sign}${h}h` : `${sign}${h}h ${m}m`;
  }

  appliesToLabel(a: ServiceAddon): string {
    if (a.appliesToAll) return 'All services';
    const names = a.appliesToServiceIds
      .map((id) => this.serviceNameById()[id])
      .filter(Boolean);
    if (names.length === 0) return '(none)';
    return names.join(', ');
  }
}
