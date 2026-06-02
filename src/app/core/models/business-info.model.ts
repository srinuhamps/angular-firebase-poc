// Phase 3: Firestore document path — 'config/business'

export interface BusinessHours {
  day: string;
  open: string;
  close: string;
  isClosed: boolean;
}

export interface BusinessInfo {
  id: string;
  name: string;
  tagline: string;
  description: string;
  // Address
  address: string;
  city: string;
  state: string;
  zip: string;
  // Contact
  phone: string;
  email: string;
  website: string;
  // Social
  instagramUrl: string;
  facebookUrl: string;
  twitterUrl?: string;
  tiktokUrl?: string;
  // Operations
  businessHours: BusinessHours[];
  mapEmbedUrl?: string;
  // Phase 3: Managed via Admin → Business Settings
}
