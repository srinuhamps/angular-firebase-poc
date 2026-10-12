import {
  ApplicationConfig,
  inject,
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
import { FirebaseApp, initializeApp, provideFirebaseApp } from '@angular/fire/app';
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
    // Single source of truth for Firebase app initialization. All other
    // provideXxx() factories inject FirebaseApp from Angular DI so we never
    // depend on the raw firebase/app module registry (which can duplicate
    // across code-split chunks in production builds).
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore(inject(FirebaseApp))),
    provideStorage(() => getStorage(inject(FirebaseApp))),
    provideAuth(() => getAuth(inject(FirebaseApp))),
    // Cloud Function region must match what's declared in functions/src/index.ts.
    provideFunctions(() => getFunctions(inject(FirebaseApp), 'us-central1')),
    // SEO — applies per-route title + meta tags on every navigation.
    { provide: TitleStrategy, useClass: SeoTitleStrategy },
  ],
};

