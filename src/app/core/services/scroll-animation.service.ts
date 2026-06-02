import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * ScrollAnimationService
 * Uses IntersectionObserver to trigger CSS reveal animations
 * when elements with the .reveal class enter the viewport.
 */
@Injectable({ providedIn: 'root' })
export class ScrollAnimationService {
  private readonly platformId = inject(PLATFORM_ID);
  private observer: IntersectionObserver | null = null;

  init(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            // Once revealed, stop observing to save resources
            this.observer?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    this.observeAll();
  }

  observeAll(): void {
    if (!isPlatformBrowser(this.platformId) || !this.observer) return;

    const elements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    elements.forEach((el) => this.observer!.observe(el));
  }

  observeElement(element: Element): void {
    if (!isPlatformBrowser(this.platformId) || !this.observer) return;
    this.observer.observe(element);
  }

  destroy(): void {
    this.observer?.disconnect();
  }
}
