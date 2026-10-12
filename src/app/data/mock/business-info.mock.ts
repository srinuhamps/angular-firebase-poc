import { BusinessInfo } from '../../core/models/business-info.model';

// Phase 3: Replace with Firestore document:
//   this.firestore.doc<BusinessInfo>('config/business').valueChanges()

export const MOCK_BUSINESS_INFO: BusinessInfo = {
  id: 'business',
  name: 'Labelle Braid BB',
  tagline: 'Where Beauty Meets Artistry',
  description:
    'Labelle Braid BB is DFW\'s premier luxury hair salon and beauty supply destination. ' +
    'We specialize in protective styles, natural hair care, and carry a curated selection of premium hair products.',
  address: '',
  city: 'Fort Worth',
  state: 'TX',
  zip: '76116',
  phone: '(404) 555-0192',
  email: 'info@labellebraidbb.com',
  website: 'https://labellebraidbb.com',
  instagramUrl: 'https://instagram.com/labellebraidbb',
  facebookUrl: 'https://facebook.com/labellebraidbb',
  twitterUrl: 'https://twitter.com/labellebraidbb',
  tiktokUrl: 'https://tiktok.com/@labellebraidbb',
  snapchatUrl: 'https://snapchat.com/add/labellebraidbb',
  youtubeUrl: 'https://youtube.com/@labellebraidbb',
  businessHours: [
    { day: 'Monday',    open: '9:00 AM',  close: '7:00 PM',  isClosed: false },
    { day: 'Tuesday',   open: '9:00 AM',  close: '7:00 PM',  isClosed: false },
    { day: 'Wednesday', open: '9:00 AM',  close: '7:00 PM',  isClosed: false },
    { day: 'Thursday',  open: '9:00 AM',  close: '7:00 PM',  isClosed: false },
    { day: 'Friday',    open: '9:00 AM',  close: '8:00 PM',  isClosed: false },
    { day: 'Saturday',  open: '8:00 AM',  close: '6:00 PM',  isClosed: false },
    { day: 'Sunday',    open: '',         close: '',          isClosed: true  },
  ],
  holidays: [],
  mapEmbedUrl: '',
};
