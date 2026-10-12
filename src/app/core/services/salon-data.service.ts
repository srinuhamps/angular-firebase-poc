import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { HairService } from '../models/hair-service.model';
import { Product } from '../models/product.model';
import { Stylist } from '../models/stylist.model';
import { Testimonial } from '../models/testimonial.model';
import { GalleryImage } from '../models/gallery-image.model';
import { MediaItem } from '../models/media-item.model';
import { BusinessInfo } from '../models/business-info.model';

import { ServicesService } from './services.service';
import { ProductsService } from './products.service';
import { BusinessInfoService } from './business-info.service';
import { MediaService } from './media.service';
import { StylistsService } from './stylists.service';
import { MOCK_TESTIMONIALS } from '../../data/mock/testimonials.mock';

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
  private readonly svcService   = inject(ServicesService);
  private readonly prdService   = inject(ProductsService);
  private readonly bizService   = inject(BusinessInfoService);
  private readonly mediaService = inject(MediaService);
  private readonly styService   = inject(StylistsService);

  // ─── Services (live Firestore) ─────────────────────────────────────────────

  getServices(): Observable<HairService[]> {
    // Public-facing: only ever show services the admin has marked available.
    return this.svcService.getAll().pipe(
      map((list) => list.filter((s) => s.isAvailable))
    );
  }

  getFeaturedServices(): Observable<HairService[]> {
    // filter client-side from live stream; no extra Firestore query
    return this.svcService.getAll().pipe(
      map((list) => list.filter((s) => s.isAvailable && s.isFeatured))
    );
  }

  getServiceById(id: string): Observable<HairService | undefined> {
    return this.svcService.getAll().pipe(
      map((list) => list.find((s) => s.id === id))
    );
  }

  getServicesByCategory(category: string): Observable<HairService[]> {
    return this.svcService.getAll().pipe(
      map((list) => list.filter((s) => s.isAvailable))
    );
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

  // ─── Stylists (live Firestore) ───────────────────────────────────────────

  /** Live from Firestore `stylists` collection; public shows available only. */
  getStylists(): Observable<Stylist[]> {
    return this.styService.getAll().pipe(
     map((list) => {
      // 1. Filter out unavailable stylists
      const availableStylists = list.filter((s) => s.isAvailable);
      
      // 2. Sort "Founder" to the top
      return availableStylists.sort((a, b) => {
        const aIsFounder = a.title?.toLowerCase() === 'founder & stylist';
        const bIsFounder = b.title?.toLowerCase() === 'founder & stylist';

        if (aIsFounder && !bIsFounder) return -1;
        if (!aIsFounder && bIsFounder) return 1;
        return 0;
      });
    })
    );
  }

  // ─── Testimonials ──────────────────────────────────────────────────────────

  /** Phase 3: collection('testimonials').where('isApproved','==',true).orderBy('date','desc') */
  getTestimonials(): Observable<Testimonial[]> {
    return of(MOCK_TESTIMONIALS.filter(t => t.isApproved));
  }

  getFeaturedTestimonials(): Observable<Testimonial[]> {
    return of(MOCK_TESTIMONIALS.filter(t => t.isApproved && t.isFeatured));
  }

  // ─── Gallery (live Firestore ‘media’ collection, uploaded via Admin → Gallery) ──

  /** Live gallery images from Firestore `media` collection, newest first.
   *  Only items tagged with the `gallery` category are returned — items
   *  uploaded exclusively for products or services are hidden from the
   *  public gallery, while multi-tagged images (e.g. `['gallery','service']`)
   *  correctly appear here. */
  getGalleryImages(): Observable<GalleryImage[]> {
    return this.mediaService.getAll().pipe(
      map((items) =>
        items.filter((i) => i.categories.includes('gallery')).map(toGalleryImage)
      )
    );
  }

  /** Home page preview — same source (gallery-tagged only), first N shown by the component. */
  getFeaturedGalleryImages(): Observable<GalleryImage[]> {
    return this.mediaService.getAll().pipe(
      map((items) =>
        items.filter((i) => i.categories.includes('gallery')).map(toGalleryImage)
      )
    );
  }

  /** Uploaded media has no category; kept for API compatibility — returns empty. */
  getGalleryByCategory(_category: string): Observable<GalleryImage[]> {
    return of([]);
  }

  // ─── Business Info (live Firestore) ────────────────────────────────────────

  /**
   * Live business profile — managed via Admin → Business Settings.
   * Returns `null` if no profile has been saved yet.
   */
  getBusinessInfo(): Observable<BusinessInfo | null> {
    return this.bizService.get();
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────────

/**
 * Adapt an uploaded MediaItem into the GalleryImage shape the public gallery
 * template expects. Category is intentionally omitted (uploads don’t carry one);
 * the template no longer renders a category badge.
 */
function toGalleryImage(m: MediaItem): GalleryImage {
  return {
    id: m.id,
    imageUrl: m.url,
    thumbnailUrl: m.url,
    title: m.title,
    category: 'styling',
    isFeatured: true,
    sortOrder: -m.createdAt, // newest first
    uploadedAt: new Date(m.createdAt),
  };
}
