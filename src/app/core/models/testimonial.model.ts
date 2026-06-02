// Phase 3: Firestore collection path — 'testimonials/{id}'

export interface Testimonial {
  id: string;
  customerName: string;
  customerInitials: string;
  serviceReceived: string;
  rating: 1 | 2 | 3 | 4 | 5;
  review: string;
  avatarUrl?: string;
  date: Date;
  isFeatured: boolean;
  isApproved: boolean;     // Phase 3: admin-controlled
}
