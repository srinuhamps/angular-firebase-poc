import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ReviewsService } from '../../../core/services/reviews.service';
import { Review, ReviewSummary } from '../../../core/models/review.model';

@Component({
  selector: 'app-digifeel-reviews',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './digifeel-reviews.component.html',
  styleUrl: './digifeel-reviews.component.scss',
})
export class DigifeelReviewsComponent implements OnInit, OnDestroy {
  private readonly reviewsSvc = inject(ReviewsService);

  readonly summary = signal<ReviewSummary | null>(null);
  readonly loading = signal(true);
  readonly startIndex = signal(0);
  readonly perView = signal(3);

  readonly reviews = computed<Review[]>(() => this.summary()?.reviews ?? []);
  readonly maxIndex = computed(() => Math.max(0, this.reviews().length - this.perView()));
  readonly canPrev = computed(() => this.startIndex() > 0);
  readonly canNext = computed(() => this.startIndex() < this.maxIndex());
  readonly slideWidth = computed(() => 100 / this.perView());
  readonly trackOffset = computed(() => `translateX(-${this.startIndex() * this.slideWidth()}%)`);

  ngOnInit(): void {
    this.syncPerView();
    window.addEventListener('resize', this.syncPerView);

    this.reviewsSvc.getReviews().subscribe({
      next: (s) => {
        this.summary.set(s);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.syncPerView);
  }

  private syncPerView = (): void => {
    const w = window.innerWidth;
    this.perView.set(w < 700 ? 1 : w < 1100 ? 2 : 3);
    this.startIndex.update((i) => Math.min(i, this.maxIndex()));
  };

  prev(): void {
    this.startIndex.update((i) => Math.max(0, i - 1));
  }

  next(): void {
    this.startIndex.update((i) => Math.min(this.maxIndex(), i + 1));
  }

  stars(rating: number): boolean[] {
    return [1, 2, 3, 4, 5].map((n) => n <= Math.round(rating));
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }
}
