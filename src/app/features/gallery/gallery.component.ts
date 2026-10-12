import { Component, AfterViewInit, inject, signal } from '@angular/core';
import { SalonDataService } from '../../core/services/salon-data.service';
import { ScrollAnimationService } from '../../core/services/scroll-animation.service';
import { GalleryImage } from '../../core/models/gallery-image.model';

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
  readonly images        = signal<GalleryImage[]>([]);
  readonly lightboxImage = signal<GalleryImage | null>(null);
  readonly loaded        = signal(false);

  constructor() {
    this.dataService.getGalleryImages().subscribe((imgs) => {
      this.images.set(imgs);
      this.loaded.set(true);
      setTimeout(() => this.scrollAnim.observeAll(), 0);
    });
  }

  ngAfterViewInit(): void {
    this.scrollAnim.observeAll();
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
