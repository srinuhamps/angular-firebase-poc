// Phase 3: Firestore collection path — 'gallery/{id}'

export type GalleryCategory =
  | 'braids'
  | 'locs'
  | 'weaves'
  | 'kids'
  | 'styling'
  | 'before-after';

export interface GalleryImage {
  id: string;
  imageUrl: string;
  thumbnailUrl: string;
  title: string;
  category: GalleryCategory;
  stylistId?: string;
  isFeatured: boolean;
  sortOrder: number;
  uploadedAt: Date;
  // Phase 3: image stored in Firebase Storage at 'gallery/{filename}'
}
