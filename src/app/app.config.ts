import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import {
  provideRouter,
  withInMemoryScrolling,
  withRouterConfig,
  TitleStrategy,
} from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideFirebaseApp } from '@angular/fire/app';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { getStorage, provideStorage } from '@angular/fire/storage';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { getFunctions, provideFunctions } from '@angular/fire/functions';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { SeoTitleStrategy } from './core/services/seo-title-strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
      withRouterConfig({ onSameUrlNavigation: 'reload' })
    ),
    provideHttpClient(withFetch()),
    // ── Firebase ────────────────────────────────────────────────────────────
    provideFirebaseApp(() =>
      getApps().length ? getApp() : initializeApp(environment.firebase)
    ),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
    provideAuth(() => getAuth()),
    // The Cloud Function region must match what's declared in functions/src/index.ts.
    provideFunctions(() => getFunctions(getApp(), 'us-central1')),
    // SEO — applies per-route title + meta tags on every navigation.
    { provide: TitleStrategy, useClass: SeoTitleStrategy },
  ],
};

