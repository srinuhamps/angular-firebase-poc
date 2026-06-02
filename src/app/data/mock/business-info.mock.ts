import { BusinessInfo } from '../../core/models/business-info.model';

// Phase 3: Replace with Firestore document:
//   this.firestore.doc<BusinessInfo>('config/business').valueChanges()

export const MOCK_BUSINESS_INFO: BusinessInfo = {
  id: 'business',
  name: 'Carolle Hair Studio',
  tagline: 'Where Beauty Meets Artistry',
  description:
    'Carolle Hair Studio is Atlanta\'s premier luxury hair salon and beauty supply destination. ' +
    'We specialize in protective styles, natural hair care, and carry a curated selection of premium hair products.',
  address: '1247 Peachtree St NE, Suite 201',
  city: 'Atlanta',
  state: 'GA',
  zip: '30309',
  phone: '(404) 555-0192',
  email: 'hello@carollehairstudio.com',
  website: 'https://carollehairstudio.com',
  instagramUrl: 'https://instagram.com/carollehairstudio',
  facebookUrl: 'https://facebook.com/carollehairstudio',
  twitterUrl: 'https://twitter.com/carollehairstudio',
  tiktokUrl: 'https://tiktok.com/@carollehairstudio',
  businessHours: [
    { day: 'Monday',    open: '9:00 AM',  close: '7:00 PM',  isClosed: false },
    { day: 'Tuesday',   open: '9:00 AM',  close: '7:00 PM',  isClosed: false },
    { day: 'Wednesday', open: '9:00 AM',  close: '7:00 PM',  isClosed: false },
    { day: 'Thursday',  open: '9:00 AM',  close: '7:00 PM',  isClosed: false },
    { day: 'Friday',    open: '9:00 AM',  close: '8:00 PM',  isClosed: false },
    { day: 'Saturday',  open: '8:00 AM',  close: '6:00 PM',  isClosed: false },
    { day: 'Sunday',    open: '',         close: '',          isClosed: true  },
  ],
  mapEmbedUrl: '',
};
