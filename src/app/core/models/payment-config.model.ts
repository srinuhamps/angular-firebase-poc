// Phase 2/3: Firestore document path — 'config/payment'

export type PaymentProvider = 'stripe' | 'square' | 'paypal' | 'manual';

export interface PaymentConfig {
  provider: PaymentProvider;
  isEnabled: boolean;
  depositPercentage: number;   // e.g. 50 = 50% deposit required
  currency: string;            // 'USD'
  acceptsManualPay: boolean;   // pay at store
  // Phase 2: provider-specific public keys stored here
  // NEVER store secret keys in Firestore — use Cloud Functions
  stripePublicKey?: string;
  squareApplicationId?: string;
  squareLocationId?: string;
}
