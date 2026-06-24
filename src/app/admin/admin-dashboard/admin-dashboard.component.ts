import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ServicesService } from '../../core/services/services.service';
import { ProductsService } from '../../core/services/products.service';
import { StylistsService } from '../../core/services/stylists.service';
import { AppointmentsService } from '../../core/services/appointments.service';
import { ContactMessagesService } from '../../core/services/contact-messages.service';
import { BusinessInfoService } from '../../core/services/business-info.service';
import { BusinessInfo } from '../../core/models/business-info.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent {
  private readonly svcService  = inject(ServicesService);
  private readonly prdService  = inject(ProductsService);
  private readonly styService  = inject(StylistsService);
  private readonly apptService = inject(AppointmentsService);
  private readonly msgService  = inject(ContactMessagesService);
  private readonly bizService  = inject(BusinessInfoService);

  /** Live business info — drives the welcome line. */
  readonly info         = signal<BusinessInfo | null>(null);
  readonly businessName = computed(() => this.info()?.name ?? 'Labelle Braids BB');

  serviceCount     = signal<number>(0);
  productCount     = signal<number>(0);
  stylistCount     = signal<number>(0);
  upcomingCount    = signal<number>(0);
  pendingCount     = signal<number>(0);
  newMessageCount  = signal<number>(0);
  openMessageCount = signal<number>(0);

  seeding   = signal<boolean>(false);
  seedDone  = signal<boolean>(false);
  seedError = signal<string>('');

  constructor() {
    this.bizService.info$.subscribe((b) => this.info.set(b));
    this.svcService.getAll().subscribe((s) => this.serviceCount.set(s.length));
    this.prdService.getAll().subscribe((p) => this.productCount.set(p.length));
    this.styService.getAll().subscribe((s) => this.stylistCount.set(s.length));
    // Live so the counters update as bookings are made / messages arrive.
    this.apptService.watchAll().subscribe((all) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      this.upcomingCount.set(
        all.filter((a) => a.date.getTime() >= today.getTime() && a.status !== 'cancelled').length
      );
      this.pendingCount.set(all.filter((a) => a.status === 'pending').length);
    });
    this.msgService.watchAll().subscribe((all) => {
      this.newMessageCount.set(all.filter((m) => m.status === 'new').length);
      this.openMessageCount.set(
        all.filter((m) => m.status === 'new' || m.status === 'read').length
      );
    });
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
          // Additive for stylists — picks up newly added mocks without disturbing existing data.
          this.styService.seedMissing(),
        ]),
        timeout,
      ]);
      this.seedDone.set(true);
      // Refresh the stylist count so the dashboard reflects the new additions.
      this.styService.getAll().subscribe((s) => this.stylistCount.set(s.length));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.seedError.set(msg);
    } finally {
      this.seeding.set(false);
    }
  }
}
