import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalonDataService } from '../../core/services/salon-data.service';
import { BusinessInfo } from '../../core/models/business-info.model';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss',
})
export class BookingComponent {
  private readonly dataService = inject(SalonDataService);

  readonly info = signal<BusinessInfo | null>(null);

  readonly steps = [
    { num: '01', label: 'Select Service'   },
    { num: '02', label: 'Choose Stylist'   },
    { num: '03', label: 'Pick Date & Time' },
    { num: '04', label: 'Your Details'     },
    { num: '05', label: 'Confirm & Pay'    },
  ];

  constructor() {
    this.dataService.getBusinessInfo().subscribe((b) => this.info.set(b));
  }

  /** Telephone link with non-digit characters stripped. */
  telHref(phone: string | undefined): string {
    return 'tel:' + (phone ?? '').replace(/[^\d+]/g, '');
  }
}
