import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalonDataService } from '../../../core/services/salon-data.service';
import {
  BusinessInfo,
  BusinessHours,
  splitBrandName,
} from '../../../core/models/business-info.model';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  private readonly dataService = inject(SalonDataService);

  readonly currentYear = new Date().getFullYear();
  readonly info = signal<BusinessInfo | null>(null);
  readonly brand = computed(() => splitBrandName(this.info()?.name));

  readonly services = [
    { label: 'Knotless Box Braids', path: '/services' },
    { label: 'Goddess Locs',        path: '/services' },
    { label: 'Bohemian Twists',     path: '/services' },
    { label: 'Sew-In Weave',        path: '/services' },
    { label: 'Kids Styles',         path: '/services' },
    { label: 'Consultation',        path: '/services' },
  ];

  readonly quickLinks = [
    { label: 'Home',        path: '/'         },
    { label: 'Services',    path: '/services' },
    { label: 'Products',    path: '/products' },
    { label: 'About Us',    path: '/about'    },
    { label: 'Gallery',     path: '/gallery'  },
    { label: 'Contact',     path: '/contact'  },
    { label: 'Book Now',    path: '/booking'  },
  ];

  constructor() {
    this.dataService.getBusinessInfo().subscribe((b) => this.info.set(b));
  }

  hoursLabel(h: BusinessHours): string {
    return h.isClosed ? 'Closed' : `${h.open} – ${h.close}`;
  }
}
