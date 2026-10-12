import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

// SEO descriptions use the `{name}` token — SeoService substitutes the live
// business name from BusinessInfoService at render time so admin renames
// flow through to <title> and <meta> tags without a redeploy.
export const routes: Routes = [
  {
    path: '',
    title: 'Luxury Hair Services & Beauty Supply',
    data: {
      seo: {
        description:
          '{name} — premium braiding, locs, weaving, and beauty supply. Book your appointment with luxury hair experts today.',
      },
    },
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'services',
    title: 'Services',
    data: {
      seo: {
        description:
          'Explore {name}’s full service menu — braids, locs, weaves, styling, and treatments by our top stylists.',
      },
    },
    loadComponent: () =>
      import('./features/services/services-page.component').then(
        (m) => m.ServicesPageComponent
      ),
  },
  {
    path: 'products',
    title: 'Beauty Supply',
    data: {
      seo: {
        description:
          'Shop curated beauty products and salon-grade hair care, hand-picked by {name}.',
      },
    },
    loadComponent: () =>
      import('./features/products/products-page.component').then(
        (m) => m.ProductsPageComponent
      ),
  },
  {
    path: 'about',
    title: 'About',
    data: {
      seo: {
        description:
          'Meet the stylists behind {name} and the story behind our hair sanctuary.',
      },
    },
    loadComponent: () =>
      import('./features/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'gallery',
    title: 'Gallery',
    data: {
      seo: {
        description:
          'A visual look at the work coming out of {name} — braids, locs, weaves, color, and styling.',
      },
    },
    loadComponent: () =>
      import('./features/gallery/gallery.component').then(
        (m) => m.GalleryComponent
      ),
  },
  {
    path: 'contact',
    title: 'Contact',
    data: {
      seo: {
        description:
          'Get in touch with {name}. Find our studio, hours, phone, and email — or send a message directly.',
      },
    },
    loadComponent: () =>
      import('./features/contact/contact.component').then(
        (m) => m.ContactComponent
      ),
  },
  {
    path: 'booking',
    title: 'Book an Appointment',
    data: {
      seo: {
        description:
          'Book your appointment at {name} online in minutes — pick a service, stylist, date, and time.',
      },
    },
    loadComponent: () =>
      import('./features/booking/booking.component').then(
        (m) => m.BookingComponent
      ),
  },
  {
    path: 'privacy-policy',
    title: 'Privacy Policy',
    data: {
      seo: {
        description:
          '{name} Privacy Policy — how we collect, use, and protect your personal information, including our SMS text message program.',
      },
    },
    loadComponent: () =>
      import('./features/legal/privacy-policy/privacy-policy.component').then(
        (m) => m.PrivacyPolicyComponent
      ),
  },
  {
    path: 'terms-of-service',
    title: 'Terms of Service',
    data: {
      seo: {
        description:
          '{name} Terms of Service — booking policies, SMS program terms, cancellation policy, and legal terms.',
      },
    },
    loadComponent: () =>
      import('./features/legal/terms-of-service/terms-of-service.component').then(
        (m) => m.TermsOfServiceComponent
      ),
  },
  {
    path: 'admin/login',
    title: 'Admin Login',
    data: { seo: { noIndex: true } },
    loadComponent: () =>
      import('./admin/admin-login/admin-login.component').then(
        (m) => m.AdminLoginComponent
      ),
  },
  {
    path: 'admin',
    title: 'Admin',
    data: { seo: { noIndex: true } },
    canActivate: [authGuard],
    loadComponent: () =>
      import('./admin/admin-layout/admin-layout.component').then(
        (m) => m.AdminLayoutComponent
      ),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./admin/admin-dashboard/admin-dashboard.component').then(
            (m) => m.AdminDashboardComponent
          ),
      },
      {
        path: 'services',
        loadComponent: () =>
          import('./admin/admin-services/admin-services.component').then(
            (m) => m.AdminServicesComponent
          ),
      },
      {
        path: 'services/new',
        loadComponent: () =>
          import('./admin/admin-services/service-form/service-form.component').then(
            (m) => m.ServiceFormComponent
          ),
      },
      {
        path: 'services/edit/:id',
        loadComponent: () =>
          import('./admin/admin-services/service-form/service-form.component').then(
            (m) => m.ServiceFormComponent
          ),
      },
      {
        path: 'addons',
        loadComponent: () =>
          import('./admin/admin-addons/admin-addons.component').then(
            (m) => m.AdminAddonsComponent
          ),
      },
      {
        path: 'addons/new',
        loadComponent: () =>
          import('./admin/admin-addons/addon-form/addon-form.component').then(
            (m) => m.AddonFormComponent
          ),
      },
      {
        path: 'addons/edit/:id',
        loadComponent: () =>
          import('./admin/admin-addons/addon-form/addon-form.component').then(
            (m) => m.AddonFormComponent
          ),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./admin/admin-products/admin-products.component').then(
            (m) => m.AdminProductsComponent
          ),
      },
      {
        path: 'gallery',
        loadComponent: () =>
          import('./admin/admin-gallery/admin-gallery.component').then(
            (m) => m.AdminGalleryComponent
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./admin/admin-settings/admin-settings.component').then(
            (m) => m.AdminSettingsComponent
          ),
      },
      {
        path: 'products/new',
        loadComponent: () =>
          import('./admin/admin-products/product-form/product-form.component').then(
            (m) => m.ProductFormComponent
          ),
      },
      {
        path: 'products/edit/:id',
        loadComponent: () =>
          import('./admin/admin-products/product-form/product-form.component').then(
            (m) => m.ProductFormComponent
          ),
      },
      {
        path: 'stylists',
        loadComponent: () =>
          import('./admin/admin-stylists/admin-stylists.component').then(
            (m) => m.AdminStylistsComponent
          ),
      },
      {
        path: 'stylists/new',
        loadComponent: () =>
          import('./admin/admin-stylists/stylist-form/stylist-form.component').then(
            (m) => m.StylistFormComponent
          ),
      },
      {
        path: 'stylists/edit/:id',
        loadComponent: () =>
          import('./admin/admin-stylists/stylist-form/stylist-form.component').then(
            (m) => m.StylistFormComponent
          ),
      },
      {
        path: 'appointments',
        loadComponent: () =>
          import('./admin/admin-appointments/admin-appointments.component').then(
            (m) => m.AdminAppointmentsComponent
          ),
      },
      {
        path: 'messages',
        loadComponent: () =>
          import('./admin/admin-messages/admin-messages.component').then(
            (m) => m.AdminMessagesComponent
          ),
      },
    ],
  },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];

