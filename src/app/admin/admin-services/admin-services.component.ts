import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServicesService } from '../../core/services/services.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { HairService } from '../../core/models/hair-service.model';

@Component({
  selector: 'app-admin-services',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-services.component.html',
  styleUrl: './admin-services.component.scss',
})
export class AdminServicesComponent {
  private readonly svcService = inject(ServicesService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast      = inject(ToastService);

  services = signal<HairService[]>([]);
  loading  = signal<boolean>(true);
  deleting = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.svcService.getAll().subscribe((s) => {
      this.services.set(s);
      this.loading.set(false);
    });
  }

  async toggleAvailable(svc: HairService): Promise<void> {
    await this.svcService.update(svc.id, { isAvailable: !svc.isAvailable });
    this.load();
  }

  async delete(id: string): Promise<void> {
    const svc = this.services().find((s) => s.id === id);
    const ok = await this.confirmSvc.ask({
      title:       'Delete service?',
      message:     `“${svc?.name ?? 'This service'}” will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete',
      danger:      true,
    });
    if (!ok) return;
    this.deleting.set(id);
    try {
      await this.svcService.delete(id);
      this.toast.success(`Deleted “${svc?.name ?? 'service'}”.`);
      this.load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Could not delete service: ' + msg);
    } finally {
      this.deleting.set(null);
    }
  }
}
