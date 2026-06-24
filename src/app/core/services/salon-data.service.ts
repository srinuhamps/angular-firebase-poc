import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { HairService } from '../models/hair-service.model';
import { Product } from '../models/product.model';
import { Stylist } from '../models/stylist.model';
import { Testimonial } from '../models/testimonial.model';
import { GalleryImage } from '../models/gallery-image.model';
import { BusinessInfo } from '../models/business-info.model';

import { ServicesService } from './services.service';
import { ProductsService } from './products.service';
import { BusinessInfoService } from './business-info.service';
import { MOCK_STYLISTS } from '../../data/mock/stylists.mock';
import { MOCK_TESTIMONIALS } from '../../data/mock/testimonials.mock';
import { MOCK_GALLERY } from '../../data/mock/gallery.mock';
import { MOCK_BUSINESS_INFO } from '../../data/mock/business-info.mock';

/**
 * SalonDataService — Phase 1 uses mock data.
 *
 * Phase 3 Migration:
 *   1. Inject `Firestore` from '@angular/fire/firestore'
 *   2. Replace `of(MOCK_*)` calls with Firestore collection queries
 *   3. Each method comment shows the target Firestore path
 */
@Injectable({ providedIn: 'root' })
export class SalonDataService {
  private readonly svcService = inject(ServicesService);
  private readonly prdService = inject(ProductsService);
  private readonly bizService = inject(BusinessInfoService);

  // ─── Services (live Firestore) ─────────────────────────────────────────────

  getServices(): Observable<HairService[]> {
    return this.svcService.getAll();
  }

  getFeaturedServices(): Observable<HairService[]> {
    // filter client-side from live stream; no extra Firestore query
    return this.svcService.getAll();
  }

  getServiceById(id: string): Observable<HairService | undefined> {
    return this.svcService.getAll().pipe(
      map((list) => list.find((s) => s.id === id))
    );
  }

  getServicesByCategory(category: string): Observable<HairService[]> {
    return this.svcService.getAll();
  }

  // ─── Products (live Firestore) ─────────────────────────────────────────────

  getProducts(): Observable<Product[]> {
    return this.prdService.getAll();
  }

  getFeaturedProducts(): Observable<Product[]> {
    return this.prdService.getAll();
  }

  getProductsByCategory(category: string): Observable<Product[]> {
    return this.prdService.getAll();
  }

  // ─── Stylists ──────────────────────────────────────────────────────────────

  /** Phase 3: collection('stylists').where('isAvailable','==',true) */
  getStylists(): Observable<Stylist[]> {
    return of(MOCK_STYLISTS.filter(s => s.isAvailable));
  }

  // ─── Testimonials ──────────────────────────────────────────────────────────

  /** Phase 3: collection('testimonials').where('isApproved','==',true).orderBy('date','desc') */
  getTestimonials(): Observable<Testimonial[]> {
    return of(MOCK_TESTIMONIALS.filter(t => t.isApproved));
  }

  getFeaturedTestimonials(): Observable<Testimonial[]> {
    return of(MOCK_TESTIMONIALS.filter(t => t.isApproved && t.isFeatured));
  }

  // ─── Gallery ───────────────────────────────────────────────────────────────

  /** Phase 3: collection('gallery').orderBy('sortOrder') */
  getGalleryImages(): Observable<GalleryImage[]> {
    return of([...MOCK_GALLERY].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  getFeaturedGalleryImages(): Observable<GalleryImage[]> {
    return of(MOCK_GALLERY.filter(g => g.isFeatured));
  }

  getGalleryByCategory(category: string): Observable<GalleryImage[]> {
    return of(MOCK_GALLERY.filter(g => g.category === category));
  }

  // ─── Business Info (live Firestore) ────────────────────────────────────────

  /** Live business profile — managed via Admin → Business Settings. */
  getBusinessInfo(): Observable<BusinessInfo> {
    return this.bizService.get();
  }
}
