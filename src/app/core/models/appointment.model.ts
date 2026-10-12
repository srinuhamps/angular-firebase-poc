// Phase 3: Firestore collection path — 'appointments/{id}'

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no-show';

export type PaymentStatus = 'unpaid' | 'deposit-paid' | 'paid';

/**
 * Denormalized snapshot of an add-on picked at booking time. We copy the
 * name/price/duration into the appointment so historical bookings stay stable
 * even if the underlying `serviceAddons/{id}` doc is edited or deleted later.
 */
export interface AppointmentAddon {
  id: string;
  name: string;
  priceDelta: number;
  durationDelta: number;
}

export interface Appointment {
  id: string;
  // Customer info
  customerId?: string;     // Phase 3: Firebase Auth UID
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  // Service & stylist
  serviceId: string;
  serviceName: string;
  servicePrice: number;
  /** Optional list of add-ons the customer bolted on. `duration` and
   *  `totalAmount` above already include the effect of these deltas. */
  addons?: AppointmentAddon[];
  stylistId?: string;         // Admin will assign offline
  stylistName?: string;        // Admin will assign offline
  // Scheduling
  date: Date;
  startTime: string;       // '10:00 AM'
  endTime: string;         // '12:00 PM'
  duration: number;        // minutes
  // Status
  status: AppointmentStatus;
  paymentStatus: PaymentStatus;
  // Financials — Phase 2: payment provider integration
  totalAmount: number;
  depositAmount: number;
  depositPaid: boolean;
  paymentMethod?: string;
  paymentTransactionId?: string;
  /** Server-managed: Stripe PaymentIntent id, set when the PI is created. */
  paymentIntentId?: string;
  /** Server-managed: which provider processed the deposit (e.g. 'stripe'). */
  paymentProvider?: string;
  /** Server-managed: timestamp when Stripe webhook confirmed depositPaid=true. */
  depositPaidAt?: Date;
  /** Server-managed: last payment failure message (from payment_intent.payment_failed). */
  paymentLastError?: string;
  // Meta
  notes?: string;
  adminNotes?: string;
  createdAt: Date;
  updatedAt?: Date;
  // SMS notifications (TCPA opt-in captured at booking)
  smsOptIn?: boolean;
  /** E.164 normalised phone used for SMS delivery (e.g. '+12145551234'). */
  smsPhone?: string;
  /** Server-managed: true once the 24h reminder SMS has been sent. */
  reminderSent?: boolean;
  reminderSentAt?: Date;
}
