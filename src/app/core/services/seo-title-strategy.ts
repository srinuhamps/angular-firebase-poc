import { Injectable, inject } from '@angular/core';
import { TitleStrategy, RouterStateSnapshot, ActivatedRouteSnapshot } from '@angular/router';
import { SeoService, SeoMeta } from './seo.service';

/**
 * Custom TitleStrategy that applies the per-route SEO bundle declared in
 * `route.data.seo` (or `route.title` for the title alone) on every navigation.
 *
 * Usage in a route:
 *   {
 *     path: 'about',
 *     title: 'About',
 *     data: { seo: { description: '...' } },
 *     loadComponent: ...
 *   }
 */
@Injectable({ providedIn: 'root' })
export class SeoTitleStrategy extends TitleStrategy {
  private readonly seo = inject(SeoService);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot);
    const seoData = this.collectSeoData(snapshot.root);
    this.seo.apply({ ...seoData, title: title ?? seoData.title });
  }

  /** Walk the activated route tree and merge any `data.seo` blocks. */
  private collectSeoData(route: ActivatedRouteSnapshot): SeoMeta {
    let merged: SeoMeta = {};
    let node: ActivatedRouteSnapshot | null = route;
    while (node) {
      const seo = (node.data as { seo?: SeoMeta } | undefined)?.seo;
      if (seo) merged = { ...merged, ...seo };
      node = node.firstChild;
    }
    return merged;
  }
}
