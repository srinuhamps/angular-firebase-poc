// Firestore document path — 'config/business'

export interface BusinessHours {
  /** Full day name, e.g. "Monday" */
  day: string;
  /** Opening time display string (e.g. "9:00 AM") */
  open: string;
  /** Closing time display string (e.g. "7:00 PM") */
  close: string;
  isClosed: boolean;
}

export interface Holiday {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Display name, e.g. "Christmas Day" */
  label: string;
  /** Optional override open time; if absent, treated as fully closed */
  open?: string;
  /** Optional override close time */
  close?: string;
}

/**
 * Split a brand display name into a stylized "script" first word and a
 * plain-style remainder. Used by the navbar / footer / hero so the cursive
 * accent always wraps the first word of the live business name.
 *
 * "Labelle Braid BB"    → { script: "Labelle", sub: "Braid BB",   subWords: ["Braid", "BB"] }
 * "Sample Studio Name"  → { script: "Sample",  sub: "Studio Name", subWords: ["Studio", "Name"] }
 */
export function splitBrandName(name: string | null | undefined): {
  script: string;
  sub: string;
  subWords: string[];
} {
  const trimmed = (name ?? '').trim();
  if (!trimmed) return { script: '', sub: '', subWords: [] };
  const parts = trimmed.split(/\s+/);
  const subWords = parts.slice(1);
  return {
    script: parts[0],
    sub: subWords.join(' '),
    subWords,
  };
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
  snapchatUrl?: string;
  youtubeUrl?: string;
  // Operations
  businessHours: BusinessHours[];
  holidays: Holiday[];
  mapEmbedUrl?: string;
  // Managed via Admin → Business Settings
}
