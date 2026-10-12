import { Component, OnInit, AfterViewInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalonDataService } from '../../core/services/salon-data.service';
import { ScrollAnimationService } from '../../core/services/scroll-animation.service';
import { BusinessInfoService } from '../../core/services/business-info.service';
import { HairService } from '../../core/models/hair-service.model';
import { Product } from '../../core/models/product.model';
import { GalleryImage } from '../../core/models/gallery-image.model';
import { BusinessInfo, splitBrandName } from '../../core/models/business-info.model';
import { SectionTitleComponent } from '../../shared/components/section-title/section-title.component';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { DigifeelReviewsComponent } from '../../shared/components/digifeel-reviews/digifeel-reviews.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    SectionTitleComponent,
    ServiceCardComponent,
    ProductCardComponent,
    DigifeelReviewsComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, AfterViewInit {
  private dataService    = inject(SalonDataService);
  private scrollAnim     = inject(ScrollAnimationService);
  private bizService     = inject(BusinessInfoService);

  featuredServices     = signal<HairService[]>([]);
  featuredProducts     = signal<Product[]>([]);
  featuredGallery      = signal<GalleryImage[]>([]);

  /** Live business info — drives the hero brand and tagline. */
  readonly info  = signal<BusinessInfo | null>(null);
  readonly brand = computed(() => splitBrandName(this.info()?.name));

  /** Google Maps search link for the Quick Contact address. */
  readonly mapsUrl = computed(() => {
    const i = this.info();
    const parts = [i?.address, i?.city || 'Fort Worth', i?.state || 'TX', i?.zip]
      .filter((p): p is string => !!p);
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(parts.join(', '));
  });

  /**
   * Compact hours summary for the Quick Contact strip.
   * Groups consecutive weekdays with identical hours into a single line
   * (e.g. "Mon – Fri: 9:00 AM – 7:00 PM") and lists Sat/Sun separately.
   */
  readonly quickHours = computed(() => {
    const hours = this.info()?.businessHours ?? [];
    if (hours.length === 0) return [];

    // Sunday is last per the mock ordering; work with the array as-is.
    // Group runs of consecutive days that share the same open/close/isClosed.
    const abbr = (day: string): string => day.slice(0, 3);
    const label = (h: { isClosed: boolean; open: string; close: string }): string =>
      h.isClosed ? 'Closed' : `${h.open} – ${h.close}`;

    const groups: { label: string }[] = [];
    let i = 0;
    while (i < hours.length) {
      let j = i;
      while (
        j + 1 < hours.length &&
        hours[j + 1].isClosed === hours[i].isClosed &&
        hours[j + 1].open    === hours[i].open    &&
        hours[j + 1].close   === hours[i].close
      ) {
        j++;
      }
      // Skip runs of closed days entirely (uncluttered strip).
      if (!hours[i].isClosed) {
        const range = i === j
          ? abbr(hours[i].day)
          : `${abbr(hours[i].day)} – ${abbr(hours[j].day)}`;
        groups.push({ label: `${range}: ${label(hours[i])}` });
      }
      i = j + 1;
    }
    return groups;
  });

  readonly features = [
    { icon: '✦', label: 'Premium Protective Styles' },
    { icon: '✦', label: 'Expert Stylists'            },
    { icon: '✦', label: 'Luxury Beauty Supply'       },
    { icon: '✦', label: 'Fort Worth, Texas'         },
  ];

  readonly stats = [
    { value: '12+',  label: 'Years of Excellence' },
    { value: '2.4K+', label: 'Happy Clients'      },
    { value: '3',    label: 'Expert Stylists'      },
    { value: '99%',  label: 'Satisfaction Rate'    },
  ];

  ngOnInit(): void {
    this.bizService.info$.subscribe((b) => this.info.set(b));
    this.dataService.getFeaturedServices().subscribe((s) => {
      this.featuredServices.set(s.slice(0, 4));
      this.reobserveReveals();
    });
    this.dataService.getFeaturedProducts().subscribe((p) => {
      this.featuredProducts.set(p.slice(0, 4));
      this.reobserveReveals();
    });
    this.dataService.getFeaturedGalleryImages().subscribe((g) => {
      this.featuredGallery.set(g.slice(0, 12));
      this.reobserveReveals();
    });
  }

  ngAfterViewInit(): void {
    this.scrollAnim.observeAll();
  }

  private reobserveReveals(): void {
    // Data arrived after ngAfterViewInit — observe the newly rendered .reveal cards.
    setTimeout(() => this.scrollAnim.observeAll(), 0);
  }
}
