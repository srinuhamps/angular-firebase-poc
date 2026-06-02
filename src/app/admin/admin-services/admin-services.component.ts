import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServicesService } from '../../core/services/services.service';
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
    if (!confirm('Delete this service? This cannot be undone.')) return;
    this.deleting.set(id);
    try {
      await this.svcService.delete(id);
      this.load();
    } finally {
      this.deleting.set(null);
    }
  }
}
