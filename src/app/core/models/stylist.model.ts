// Phase 3: Firestore collection path — 'stylists/{id}'

export interface Stylist {
  id: string;
  name: string;
  title: string;
  bio: string;
  imageUrl: string;
  specialties: string[];
  yearsExperience: number;
  isAvailable: boolean;
  instagramUrl?: string;
  // Phase 2: availability slots will be sub-collection 'stylists/{id}/availability'
}
