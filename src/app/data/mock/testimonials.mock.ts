import { Testimonial } from '../../core/models/testimonial.model';

// Phase 3: Replace with Firestore query:
//   this.firestore.collection<Testimonial>('testimonials',
//     ref => ref.where('isApproved', '==', true).orderBy('date', 'desc')
//   ).valueChanges()

export const MOCK_TESTIMONIALS: Testimonial[] = [
  {
    id: 'tst-1',
    customerName: 'Amara Johnson',
    customerInitials: 'AJ',
    serviceReceived: 'Knotless Box Braids',
    rating: 5,
    review:
      "I've been searching for my go-to braid salon for years. Carolle is it. My knotless braids lasted over 3 months and looked freshly done the entire time. The attention to detail is unmatched. I won't go anywhere else.",
    date: new Date('2025-12-10'),
    isFeatured: true,
    isApproved: true,
  },
  {
    id: 'tst-2',
    customerName: 'Destiny Williams',
    customerInitials: 'DW',
    serviceReceived: 'Goddess Locs',
    rating: 5,
    review:
      "Carolle did my goddess locs and I am OBSESSED. They are so perfectly done — every single one. The shop is gorgeous, the vibe is luxurious, and Carolle herself makes you feel so at home. 10/10 experience.",
    date: new Date('2025-11-22'),
    isFeatured: true,
    isApproved: true,
  },
  {
    id: 'tst-3',
    customerName: 'Keisha Thompson',
    customerInitials: 'KT',
    serviceReceived: 'Kids Box Braids',
    rating: 5,
    review:
      "My daughter is tender-headed and salons are usually a nightmare. Not at Carolle's! She was so gentle, patient, and kept my daughter entertained the whole time. Her braids look absolutely beautiful.",
    date: new Date('2025-11-05'),
    isFeatured: true,
    isApproved: true,
  },
  {
    id: 'tst-4',
    customerName: 'Nadia Osei',
    customerInitials: 'NO',
    serviceReceived: 'Bohemian Twists',
    rating: 5,
    review:
      "I've been coming to Carolle for over 2 years now and every single visit exceeds my expectations. My passion twists are always flawless, and I always leave feeling like a queen. This place is a gem.",
    date: new Date('2025-10-18'),
    isFeatured: true,
    isApproved: true,
  },
  {
    id: 'tst-5',
    customerName: 'Simone Grant',
    customerInitials: 'SG',
    serviceReceived: 'Beauty Supply Products',
    rating: 5,
    review:
      "I stop by the beauty supply side almost every week. They carry the best hair care products I've ever found in one place, and the staff always knows exactly what I need for my hair type. So convenient!",
    date: new Date('2025-09-30'),
    isFeatured: true,
    isApproved: true,
  },
  {
    id: 'tst-6',
    customerName: 'Rachel Moore',
    customerInitials: 'RM',
    serviceReceived: 'Natural Hair Styling',
    rating: 4,
    review:
      "Got a silk press and it was absolutely gorgeous. My hair has never been this smooth and shiny. She used the perfect products and temperature for my fine 4C hair. Will definitely be back for my monthly blowout.",
    date: new Date('2025-09-12'),
    isFeatured: false,
    isApproved: true,
  },
];
