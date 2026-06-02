import { Component, OnInit, AfterViewInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalonDataService } from '../../core/services/salon-data.service';
import { ScrollAnimationService } from '../../core/services/scroll-animation.service';
import { HairService } from '../../core/models/hair-service.model';
import { Product } from '../../core/models/product.model';
import { Testimonial } from '../../core/models/testimonial.model';
import { GalleryImage } from '../../core/models/gallery-image.model';
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
export class HomeComponent implements OnInit, AfterViewInit {
  private dataService    = inject(SalonDataService);
  private scrollAnim     = inject(ScrollAnimationService);

  featuredServices: HairService[]  = [];
  featuredProducts: Product[]      = [];
  featuredTestimonials: Testimonial[] = [];
  featuredGallery: GalleryImage[]  = [];

  activeTestimonial = 0;
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
    this.dataService.getFeaturedServices().subscribe(s => (this.featuredServices = s.slice(0, 4)));
    this.dataService.getFeaturedProducts().subscribe(p => (this.featuredProducts = p.slice(0, 4)));
    this.dataService.getFeaturedTestimonials().subscribe(t => {
      this.featuredTestimonials = t;
      this.startTestimonialRotation();
    });
    this.dataService.getFeaturedGalleryImages().subscribe(g => (this.featuredGallery = g.slice(0, 6)));
  }

  ngAfterViewInit(): void {
    this.scrollAnim.observeAll();
  }

  ngOnDestroy(): void {
    if (this.testimonialTimer) clearInterval(this.testimonialTimer);
  }

  private startTestimonialRotation(): void {
    this.testimonialTimer = setInterval(() => {
      this.activeTestimonial =
        (this.activeTestimonial + 1) % this.featuredTestimonials.length;
    }, 5000);
  }

  setTestimonial(index: number): void {
    this.activeTestimonial = index;
    if (this.testimonialTimer) {
      clearInterval(this.testimonialTimer);
      this.startTestimonialRotation();
    }
  }

  prevTestimonial(): void {
    const len = this.featuredTestimonials.length;
    this.setTestimonial((this.activeTestimonial - 1 + len) % len);
  }

  nextTestimonial(): void {
    this.setTestimonial((this.activeTestimonial + 1) % this.featuredTestimonials.length);
  }
}
