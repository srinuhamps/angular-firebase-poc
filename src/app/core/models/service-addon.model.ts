// Phase 3: Firestore collection path — 'serviceAddons/{id}'
//
// An add-on is an optional modifier a customer can bolt on to a base service
// during booking (e.g. "+ Blow Dry — 20 min @ $15" or the negative-delta
// "− 2h 30m @ $200" for a two-people-simultaneously discount). Add-ons are
// stored as SIGNED deltas so both surcharges and discounts / time savings are
// modeled uniformly. Totals fold into the appointment at submit time.

export interface ServiceAddon {
  id: string;
  name: string;
  /** Positive to charge extra, negative to discount. */
  priceDelta: number;
  /** Positive to lengthen the appointment, negative to shorten. In minutes. */
  durationDelta: number;
  /** When true, this add-on is offered for every service (ignores linked IDs). */
  appliesToAll: boolean;
  /** Service IDs this add-on applies to when `appliesToAll` is false. */
  appliesToServiceIds: string[];
  /** Only active add-ons appear in the booking wizard. */
  isActive: boolean;
  /** Ascending — lower values sort first in the customer picker. */
  sortOrder: number;
}
