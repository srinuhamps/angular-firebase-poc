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
  inStock: boolean;
  stockQuantity: number;
  isFeatured: boolean;
  tags: string[];
  sortOrder: number;
}
