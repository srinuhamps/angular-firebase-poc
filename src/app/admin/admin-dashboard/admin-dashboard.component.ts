import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServicesService } from '../../core/services/services.service';
import { ProductsService } from '../../core/services/products.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  private readonly svcService = inject(ServicesService);
  private readonly prdService = inject(ProductsService);

  serviceCount = signal<number>(0);
  productCount = signal<number>(0);
  seeding      = signal<boolean>(false);
  seedDone     = signal<boolean>(false);
  seedError    = signal<string>('');

  constructor() {
    this.svcService.getAll().subscribe((s) => this.serviceCount.set(s.length));
    this.prdService.getAll().subscribe((p) => this.productCount.set(p.length));
  }

  async seedData(): Promise<void> {
    this.seeding.set(true);
    this.seedError.set('');

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timed out after 15 s — check Firestore is created and rules allow writes.')), 15_000)
    );

    try {
      await Promise.race([
        Promise.all([
          this.svcService.seedIfEmpty(),
          this.prdService.seedIfEmpty(),
        ]),
        timeout,
      ]);
      this.seedDone.set(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.seedError.set(msg);
    } finally {
      this.seeding.set(false);
    }
  }
}
