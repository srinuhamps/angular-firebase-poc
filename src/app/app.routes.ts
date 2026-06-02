import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'services',
    loadComponent: () =>
      import('./features/services/services-page.component').then(
        (m) => m.ServicesPageComponent
      ),
  },
  {
    path: 'products',
    loadComponent: () =>
      import('./features/products/products-page.component').then(
        (m) => m.ProductsPageComponent
      ),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./features/about/about.component').then((m) => m.AboutComponent),
  },
  {
    path: 'gallery',
    loadComponent: () =>
      import('./features/gallery/gallery.component').then(
        (m) => m.GalleryComponent
      ),
  },
  {
    path: 'contact',
    loadComponent: () =>
      import('./features/contact/contact.component').then(
        (m) => m.ContactComponent
      ),
  },
  {
    path: 'booking',
    // Phase 2: Full booking flow — see BookingComponent for placeholder details
    loadComponent: () =>
      import('./features/booking/booking.component').then(
        (m) => m.BookingComponent
      ),
  },
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./admin/admin-login/admin-login.component').then(
        (m) => m.AdminLoginComponent
      ),
  },
  {
    path: 'admin',
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
    ],
  },
  { path: '**', redirectTo: '', pathMatch: 'full' },
];

