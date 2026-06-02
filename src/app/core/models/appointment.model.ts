// Phase 3: Firestore collection path — 'appointments/{id}'

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no-show';

export type PaymentStatus = 'unpaid' | 'deposit-paid' | 'paid';

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
  stylistId: string;
  stylistName: string;
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
  // Meta
  notes?: string;
  adminNotes?: string;
  createdAt: Date;
  updatedAt?: Date;
}
