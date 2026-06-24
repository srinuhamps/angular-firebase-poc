import { Injectable, inject, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import { environment } from '../../../environments/environment';
import { BusinessInfoService } from './business-info.service';

/**
 * Per-page SEO metadata. All fields are optional — anything you skip falls
 * back to a sensible site-wide default.
 *
 * `title` and `description` may include the literal token `{name}`, which is
 * substituted with the live business name from BusinessInfoService at render
 * time. This keeps route declarations static while letting admins rename
 * the business from the Settings page.
 */
export interface SeoMeta {
  /** Document <title>. The page's specific name (e.g. "About"). */
  title?: string;
  /** <meta name="description">. ~140-160 chars. Supports `{name}` token. */
  description?: string;
  /** Canonical absolute URL. Defaults to siteUrl + current pathname. */
  canonical?: string;
  /** OG image absolute URL. Defaults to environment.defaultOgImage. */
  ogImage?: string;
  /** OG type. Defaults to 'website'. */
  ogType?: 'website' | 'article' | 'profile';
  /** noindex prevents search engines from indexing the page. */
  noIndex?: boolean;
}

const FALLBACK_NAME = 'Labelle Braids BB';

const DEFAULT_DESCRIPTION =
  '{name} — luxury braiding, locs, weaving, and beauty supply. Book your appointment today.';

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly titleSvc = inject(Title);
  private readonly metaSvc  = inject(Meta);
  private readonly doc      = inject(DOCUMENT);
  private readonly biz      = inject(BusinessInfoService);

  /** Latest business name; tracked so title suffix + descriptions stay live. */
  private readonly businessName = signal<string>(FALLBACK_NAME);
  /** Last applied SEO bundle — replayed whenever the business name changes. */
  private lastMeta: SeoMeta | null = null;

  constructor() {
    this.biz.info$.subscribe((b) => {
      const name = (b?.name ?? '').trim() || FALLBACK_NAME;
      if (name === this.businessName()) return;
      this.businessName.set(name);
      // Re-apply with the new name so existing meta tags stay in sync.
      if (this.lastMeta) this.apply(this.lastMeta);
    });
  }

  /**
   * Apply a full set of SEO metadata. Call this once per route change
   * (the SeoTitleStrategy wires it up for routes that declare `data.seo`).
   */
  apply(meta: SeoMeta): void {
    this.lastMeta = meta;
    const name = this.businessName();
    const titleSuffix = ` | ${name}`;

    const fullTitle = meta.title
      ? `${this.interpolate(meta.title, name)}${titleSuffix}`
      : `${name} | Luxury Hair Services & Beauty Supply`;

    this.titleSvc.setTitle(fullTitle);

    const description = this.interpolate(meta.description ?? DEFAULT_DESCRIPTION, name);
    const canonical   = meta.canonical   ?? this.absoluteUrl(this.doc.location?.pathname ?? '/');
    const ogImage     = this.absoluteUrl(meta.ogImage ?? environment.defaultOgImage);
    const ogType      = meta.ogType ?? 'website';

    this.upsertTag({ name: 'description' },               description);
    this.upsertTag({ property: 'og:title' },              fullTitle);
    this.upsertTag({ property: 'og:description' },        description);
    this.upsertTag({ property: 'og:type' },               ogType);
    this.upsertTag({ property: 'og:url' },                canonical);
    this.upsertTag({ property: 'og:image' },              ogImage);
    this.upsertTag({ property: 'og:site_name' },          name);
    this.upsertTag({ name: 'twitter:card' },              'summary_large_image');
    this.upsertTag({ name: 'twitter:title' },             fullTitle);
    this.upsertTag({ name: 'twitter:description' },       description);
    this.upsertTag({ name: 'twitter:image' },             ogImage);

    if (meta.noIndex) {
      this.upsertTag({ name: 'robots' }, 'noindex, nofollow');
    } else {
      this.upsertTag({ name: 'robots' }, 'index, follow');
    }

    this.upsertLink('canonical', canonical);
  }

  /** Replace `{name}` placeholders with the live business name. */
  private interpolate(value: string, name: string): string {
    return value.replace(/\{name\}/g, name);
  }

  private upsertTag(selector: Record<string, string>, content: string): void {
    const key = Object.entries(selector).map(([k, v]) => `${k}="${v}"`).join('');
    if (this.metaSvc.getTag(key)) {
      this.metaSvc.updateTag({ ...selector, content });
    } else {
      this.metaSvc.addTag({ ...selector, content });
    }
  }

  private upsertLink(rel: string, href: string): void {
    let link = this.doc.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!link) {
      link = this.doc.createElement('link');
      link.setAttribute('rel', rel);
      this.doc.head.appendChild(link);
    }
    link.setAttribute('href', href);
  }

  /** Resolve an absolute URL using environment.siteUrl as the origin. */
  private absoluteUrl(pathOrUrl: string): string {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    const base = environment.siteUrl.replace(/\/$/, '');
    const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
    return base + path;
  }
}
