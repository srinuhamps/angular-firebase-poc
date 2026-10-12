import { Injectable, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { environment } from '../../../environments/environment';

/**
 * StripeService
 *
 * Thin wrapper around Stripe.js + the `createStripePaymentIntent` Firebase
 * Cloud Function. The secret key never enters the browser; the publishable
 * key (safe to expose) comes from environment.stripePublishableKey.
 *
 * Usage:
 *   1. Call `getStripe()` to lazy-load the SDK (returns a cached Promise).
 *   2. Call `createPaymentIntent(appointmentId)` from the frontend to have
 *      the server create a PaymentIntent for the 20% deposit.
 *   3. Use the returned clientSecret with `stripe.confirmCardPayment(...)`.
 */

interface CreatePaymentIntentRequest {
  appointmentId: string;
}

export interface CreatePaymentIntentResult {
  clientSecret: string;
  paymentIntentId: string;
  amountCents: number;
}

@Injectable({ providedIn: 'root' })
export class StripeService {
  private readonly functions = inject(Functions);
  private stripePromise?: Promise<Stripe | null>;

  /** Lazy-loads Stripe.js on first call. Cached for the lifetime of the app. */
  getStripe(): Promise<Stripe | null> {
    if (!this.stripePromise) {
      const key = environment.stripePublishableKey;
      if (!key) {
        return Promise.reject(
          new Error('Stripe publishable key is not configured in environment.'),
        );
      }
      this.stripePromise = loadStripe(key);
    }
    return this.stripePromise;
  }

  /**
   * Ask the Cloud Function to create a PaymentIntent for the given
   * appointment. The server recomputes the deposit amount from Firestore, so
   * we can't accidentally under-charge or be tampered with.
   */
  async createPaymentIntent(appointmentId: string): Promise<CreatePaymentIntentResult> {
    const callable = httpsCallable<CreatePaymentIntentRequest, CreatePaymentIntentResult>(
      this.functions,
      'createStripePaymentIntent',
    );
    const result = await callable({ appointmentId });
    return result.data;
  }
}
