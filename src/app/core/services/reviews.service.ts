import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Observable, from, map } from 'rxjs';
import { ReviewSummary } from '../models/review.model';

/**
 * Google reviews sourced from Digifeel. The widget script embeds its data and
 * sends no CORS header, so the `getReviews` callable reads it server-side.
 */
@Injectable({ providedIn: 'root' })
export class ReviewsService {
  private readonly functions = inject(Functions);

  getReviews(): Observable<ReviewSummary> {
    const callable = httpsCallable<unknown, ReviewSummary>(this.functions, 'getReviews');
    return from(callable({})).pipe(map((res) => res.data));
  }
}
