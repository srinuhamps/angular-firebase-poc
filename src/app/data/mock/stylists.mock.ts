import { Stylist } from '../../core/models/stylist.model';

// Phase 3: Replace with Firestore query:
//   this.firestore.collection<Stylist>('stylists', ref => ref.where('isAvailable', '==', true)).valueChanges()

export const MOCK_STYLISTS: Stylist[] = [
  {
    id: 'sty-1',
    name: 'Carolle Mensah',
    title: 'Master Stylist & Founder',
    bio:
      'With over 12 years of experience in protective styling, Carolle founded her studio with a vision: to create a luxury hair care experience where every client feels seen, pampered, and transformed. Specializing in knotless braids, goddess locs, and hair health restoration.',
    imageUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=600&q=80',
    specialties: ['Knotless Box Braids', 'Goddess Locs', 'Hair Restoration', 'Natural Hair'],
    yearsExperience: 12,
    isAvailable: true,
    instagramUrl: 'https://instagram.com/carollehairstudio',
  },
  {
    id: 'sty-2',
    name: 'Jasmine Torres',
    title: 'Braiding Specialist',
    bio:
      'Jasmine brings 7 years of precision braiding expertise to the studio. Known for her incredibly neat parts and long-lasting styles, she specializes in all braid sizes from micro to jumbo, and has a particular gift for intricate braided updos.',
    imageUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=600&q=80',
    specialties: ['Box Braids', 'Cornrows', 'Braided Updos', 'Kids Styles'],
    yearsExperience: 7,
    isAvailable: true,
    instagramUrl: '',
  },
  {
    id: 'sty-3',
    name: 'Nadia Asante',
    title: 'Locs & Twists Expert',
    bio:
      'Nadia\'s passion for locs culture runs deep. With 6 years of experience guiding clients through every stage of their loc journey, from sisterlocks to traditional locs, she provides maintenance, styling, and education with equal care.',
    imageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&q=80',
    specialties: ['Faux Locs', 'Goddess Locs', 'Loc Maintenance', 'Passion Twists'],
    yearsExperience: 6,
    isAvailable: true,
    instagramUrl: '',
  },
];
