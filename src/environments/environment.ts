export const environment = {
  production: false,
  // Public URL of the deployed site — used for canonical / OG / sitemap links
  // and for admin dashboard links in outgoing email templates.
  siteUrl: 'https://labellebraidbb.com',
  defaultOgImage: '/og-cover.jpg',
  firebase: {
    apiKey: 'AIzaSyCJZvxjCDMfvMVQM8rkqK7NpkIrXqt7Dw4',
    authDomain: 'labelle-braids-bb.firebaseapp.com',
    projectId: 'labelle-braids-bb',
    storageBucket: 'labelle-braids-bb.firebasestorage.app',
    messagingSenderId: '1091739587430',
    appId: '1:1091739587430:web:ab69283e827a3933b4eea7',
    measurementId: 'G-CPPGGTF983',
  },
  // Stripe — publishable key is safe in the browser bundle by design.
  // Test key; swap to `pk_live_...` in environment.prod.ts before going live.
  stripePublishableKey:
    'pk_test_51TlKYc2OHp5LzuuOvL7nCb6kk6dX962OWBqEwv4BdY9D4BrOQVHKjjLpyKuPZedJVjCavHGFu11u28ZDc2mH84KW00bFp9DjFU',
};
