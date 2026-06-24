import { Component, OnInit, OnDestroy, AfterViewInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalonDataService } from '../../core/services/salon-data.service';
import { ScrollAnimationService } from '../../core/services/scroll-animation.service';
import { BusinessInfoService } from '../../core/services/business-info.service';
import { HairService } from '../../core/models/hair-service.model';
import { Product } from '../../core/models/product.model';
import { Testimonial } from '../../core/models/testimonial.model';
import { GalleryImage } from '../../core/models/gallery-image.model';
import { BusinessInfo, splitBrandName } from '../../core/models/business-info.model';
import { SectionTitleComponent } from '../../shared/components/section-title/section-title.component';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';
import { TestimonialCardComponent } from '../../shared/components/testimonial-card/testimonial-card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    SectionTitleComponent,
    ServiceCardComponent,
    ProductCardComponent,
    TestimonialCardComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {
  private dataService    = inject(SalonDataService);
  private scrollAnim     = inject(ScrollAnimationService);
  private bizService     = inject(BusinessInfoService);

  featuredServices     = signal<HairService[]>([]);
  featuredProducts     = signal<Product[]>([]);
  featuredTestimonials = signal<Testimonial[]>([]);
  featuredGallery      = signal<GalleryImage[]>([]);

  /** Live business info — drives the hero brand and tagline. */
  readonly info  = signal<BusinessInfo | null>(null);
  readonly brand = computed(() => splitBrandName(this.info()?.name));

  activeTestimonial = signal<number>(0);
  testimonialTimer: ReturnType<typeof setInterval> | null = null;

  readonly features = [
    { icon: '✦', label: 'Premium Protective Styles' },
    { icon: '✦', label: 'Expert Stylists'            },
    { icon: '✦', label: 'Luxury Beauty Supply'       },
    { icon: '✦', label: 'Atlanta, Georgia'            },
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
    this.dataService.getFeaturedTestimonials().subscribe((t) => {
      this.featuredTestimonials.set(t);
      this.startTestimonialRotation();
      this.reobserveReveals();
    });
    this.dataService.getFeaturedGalleryImages().subscribe((g) => {
      this.featuredGallery.set(g.slice(0, 6));
      this.reobserveReveals();
    });
  }

  ngAfterViewInit(): void {
    this.scrollAnim.observeAll();
  }

  ngOnDestroy(): void {
    if (this.testimonialTimer) clearInterval(this.testimonialTimer);
  }

  private reobserveReveals(): void {
    // Data arrived after ngAfterViewInit — observe the newly rendered .reveal cards.
    setTimeout(() => this.scrollAnim.observeAll(), 0);
  }

  private startTestimonialRotation(): void {
    if (this.testimonialTimer) clearInterval(this.testimonialTimer);
    const len = this.featuredTestimonials().length;
    if (len === 0) return;
    this.testimonialTimer = setInterval(() => {
      this.activeTestimonial.update((i) => (i + 1) % this.featuredTestimonials().length);
    }, 5000);
  }

  setTestimonial(index: number): void {
    this.activeTestimonial.set(index);
    if (this.testimonialTimer) {
      clearInterval(this.testimonialTimer);
      this.startTestimonialRotation();
    }
  }

  prevTestimonial(): void {
    const len = this.featuredTestimonials().length;
    if (len === 0) return;
    this.setTestimonial((this.activeTestimonial() - 1 + len) % len);
  }

  nextTestimonial(): void {
    const len = this.featuredTestimonials().length;
    if (len === 0) return;
    this.setTestimonial((this.activeTestimonial() + 1) % len);
  }
}
