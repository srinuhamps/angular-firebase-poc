import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Firebase is initialized inside app.config.ts via provideFirebaseApp().
// Do NOT call initializeApp() here — a second init path can cause
// "No Firebase App '[DEFAULT]' has been created" in production bundles
// due to duplicate module registries between the raw firebase/app SDK
// and @angular/fire's DI-registered app.
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
