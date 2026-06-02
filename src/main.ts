import { bootstrapApplication } from '@angular/platform-browser';
import { initializeApp, getApps } from 'firebase/app';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

// Initialize the default Firebase app ONCE, before Angular bootstraps.
// AngularFire and the raw firebase/* SDK will both share this single instance,
// which means they also share auth state.
if (!getApps().length) {
  initializeApp(environment.firebase);
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
