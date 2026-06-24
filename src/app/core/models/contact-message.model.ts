// Firestore collection path: 'contactMessages/{id}'

export type ContactMessageStatus = 'new' | 'read' | 'replied' | 'archived';

export interface ContactMessageReply {
  body: string;
  sentAt: Date;
  sentBy?: string;                  // admin email or uid (best-effort)
  // Populated once a real email provider (Brevo) is wired up.
  emailProviderMessageId?: string;
  emailDelivered?: boolean;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;                  // form value, e.g. 'booking' | 'services' | 'other'
  message: string;
  status: ContactMessageStatus;
  createdAt: Date;
  updatedAt?: Date;
  replies: ContactMessageReply[];
  adminNotes?: string;
}

/** Human-readable label for the coded subject values used by the public form. */
export const CONTACT_SUBJECT_LABELS: Record<string, string> = {
  booking:  'Booking Inquiry',
  services: 'Services Question',
  products: 'Products Question',
  pricing:  'Pricing',
  other:    'Other',
};
