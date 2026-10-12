// Phase 3: Firestore collection path — 'products/{id}'

export type ProductCategory =
  | 'hair-care'
  | 'braiding-hair'
  | 'extensions'
  | 'styling'
  | 'tools'
  | 'accessories';

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  shortDescription: string;
  description: string;
  price: number;
  imageUrl: string;
  /** Additional images shown in the product details gallery / carousel. */
  mediaUrls?: string[];
  /** Optional video URL (YouTube embed, Vimeo, or Firebase Storage .mp4). */
  videoUrl?: string;
  inStock: boolean;
  stockQuantity: number;
  isFeatured: boolean;
  tags: string[];
  sortOrder: number;
}
