/**
 * Where an uploaded image is intended to be used on the site.
 *  - `gallery`  : shown on the public Gallery page + Home preview
 *  - `product`  : available to attach to a product card (Admin → Products)
 *  - `service`  : available to attach to a service card (Admin → Services)
 *  - `internal` : site furniture (hero backgrounds, banners, UI placeholders)
 *
 * `internal` is exclusive — it never combines with the other three.
 * A single media item may belong to any combination of the others
 * (e.g. an image tagged `['gallery', 'service']` shows on the public
 * gallery AND is available in the Service form's image picker).
 *
 * Legacy documents saved before this schema used a single `category`
 * string field; they are normalized to `[category]` at read time.
 */
export type MediaCategory = 'gallery' | 'product' | 'service' | 'internal';

export interface MediaItem {
  id: string;
  title: string;
  url: string;         // public download URL
  storagePath: string; // Firebase Storage path for deletion
  createdAt: number;   // epoch ms
  categories: MediaCategory[];
}
