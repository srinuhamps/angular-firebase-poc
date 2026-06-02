// Phase 3: Firestore collection path — 'services/{id}'

export type ServiceCategory =
  | 'braiding'
  | 'locs'
  | 'weaving'
  | 'styling'
  | 'kids'
  | 'consultation';

export interface HairService {
  id: string;
  name: string;
  category: ServiceCategory;
  shortDescription: string;
  description: string;
  price: number;
  duration: number;       // minutes
  imageUrl: string;
  isAvailable: boolean;
  isFeatured: boolean;
  bookingEnabled: boolean;
  tags: string[];
  sortOrder: number;
}
