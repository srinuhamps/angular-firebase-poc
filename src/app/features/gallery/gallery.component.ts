import { Component, AfterViewInit, computed, inject, signal } from '@angular/core';
import { SalonDataService } from '../../core/services/salon-data.service';
import { ScrollAnimationService } from '../../core/services/scroll-animation.service';
import { GalleryImage, GalleryCategory } from '../../core/models/gallery-image.model';

type FilterCat = GalleryCategory | 'all';

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent implements AfterViewInit {
  private dataService = inject(SalonDataService);
  private scrollAnim  = inject(ScrollAnimationService);

  // Signal-backed so zoneless change detection picks up the async Firestore result.
  readonly allImages     = signal<GalleryImage[]>([]);
  readonly lightboxImage = signal<GalleryImage | null>(null);
  readonly activeFilter  = signal<FilterCat>('all');

  readonly filters: { label: string; value: FilterCat }[] = [
    { label: 'All',           value: 'all'          },
    { label: 'Braids',        value: 'braids'       },
    { label: 'Locs',          value: 'locs'         },
    { label: 'Weaves',        value: 'weaves'       },
    { label: 'Kids',          value: 'kids'         },
    { label: 'Styling',       value: 'styling'      },
    { label: 'Before & After',value: 'before-after' },
  ];

  readonly filteredImages = computed<GalleryImage[]>(() => {
    const f = this.activeFilter();
    const all = this.allImages();
    return f === 'all' ? all : all.filter((i) => i.category === f);
  });

  constructor() {
    this.dataService.getGalleryImages().subscribe((imgs) => {
      this.allImages.set(imgs);
      setTimeout(() => this.scrollAnim.observeAll(), 0);
    });
  }

  ngAfterViewInit(): void {
    this.scrollAnim.observeAll();
  }

  setFilter(f: FilterCat): void {
    this.activeFilter.set(f);
    setTimeout(() => this.scrollAnim.observeAll(), 50);
  }

  openLightbox(img: GalleryImage): void {
    this.lightboxImage.set(img);
    document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.lightboxImage.set(null);
    document.body.style.overflow = '';
  }
}
