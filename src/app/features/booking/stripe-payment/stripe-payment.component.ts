import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Stripe, StripeCardElement, StripeElements, StripeElementStyle } from '@stripe/stripe-js';

import { StripeService } from '../../../core/services/stripe.service';
import { ThemeService } from '../../../core/services/theme.service';

/**
 * StripePaymentComponent
 *
 * Renders the Stripe Elements card input inline in booking step 5 when the
 * customer selects the "Card deposit (20%)" option. The parent booking
 * component holds a viewChild ref and calls `confirm(clientSecret, name)`
 * once the appointment doc + PaymentIntent are created server-side.
 *
 * Test cards (Stripe test mode):
 *   4242 4242 4242 4242 — success
 *   4000 0025 0000 3155 — requires 3D Secure authentication
 *   4000 0000 0000 9995 — declined
 */

export interface StripePaymentResult {
  success: boolean;
  paymentIntentId?: string;
  error?: string;
}

@Component({
  selector: 'app-stripe-payment',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './stripe-payment.component.html',
  styleUrl: './stripe-payment.component.scss',
})
export class StripePaymentComponent implements OnDestroy {
  private readonly stripeService = inject(StripeService);
  private readonly themeService = inject(ThemeService);

  readonly cardEl = viewChild.required<ElementRef<HTMLDivElement>>('cardEl');

  readonly ready = signal(false);
  readonly loading = signal(true);
  readonly error = signal('');
  /** True once the customer has entered a fully valid card number, expiry, CVC and postal. */
  readonly complete = signal(false);

  private stripe: Stripe | null = null;
  private elements: StripeElements | null = null;
  private cardElement: StripeCardElement | null = null;

  constructor() {
    effect(() => {
      const style = this.cardStyle();
      if (this.ready()) this.cardElement?.update({ style });
    });
    // Mount the Stripe Elements card input after the view is available.
    afterNextRender(() => {
      void this.mount();
    });
  }

  private async mount(): Promise<void> {
    try {
      this.stripe = await this.stripeService.getStripe();
      if (!this.stripe) {
        throw new Error('Stripe failed to initialise.');
      }

      this.elements = this.stripe.elements();
      this.cardElement = this.elements.create('card', {
        hidePostalCode: false,
        style: this.cardStyle(),
      });

      this.cardElement.mount(this.cardEl().nativeElement);
      this.cardElement.on('change', (e) => {
        // Only surface validation errors from the card element itself here;
        // charge failures are surfaced by `confirm()` below.
        this.error.set(e.error?.message ?? '');
        this.complete.set(!!e.complete);
      });

      this.ready.set(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.error.set('Could not load secure payment form: ' + msg);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Confirms the PaymentIntent identified by `clientSecret` using the card
   * input the customer typed into the Stripe Element. Called by the booking
   * component after it creates the appointment and PaymentIntent server-side.
   */
  async confirm(clientSecret: string, customerName: string): Promise<StripePaymentResult> {
    if (!this.stripe || !this.cardElement) {
      const msg = 'Payment form is not ready. Please wait a moment and try again.';
      this.error.set(msg);
      return { success: false, error: msg };
    }

    this.error.set('');

    const result = await this.stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card: this.cardElement,
        billing_details: { name: customerName },
      },
    });

    if (result.error) {
      const msg = result.error.message ?? 'Payment failed. Please try again.';
      this.error.set(msg);
      return { success: false, error: msg };
    }

    if (result.paymentIntent?.status === 'succeeded') {
      return { success: true, paymentIntentId: result.paymentIntent.id };
    }

    const msg =
      result.paymentIntent?.status === 'requires_action'
        ? 'Additional verification is required — please follow the prompt.'
        : `Payment did not complete (status: ${result.paymentIntent?.status ?? 'unknown'}).`;
    this.error.set(msg);
    return { success: false, error: msg };
  }

  private cardStyle(): StripeElementStyle {
    const light = this.themeService.theme() === 'light';
    return {
      base: {
        fontSize: '16px',
        fontFamily: 'Roboto, sans-serif',
        color: light ? '#1a110a' : '#f5f0e8',
        iconColor: light ? '#534b40' : '#b0b0b0',
        '::placeholder': { color: light ? '#534b40' : '#b0b0b0' },
      },
      invalid: {
        color: light ? '#a32121' : '#ffaaaa',
        iconColor: light ? '#a32121' : '#ffaaaa',
      },
    };
  }

  ngOnDestroy(): void {
    this.cardElement?.destroy();
    this.cardElement = null;
    this.elements = null;
    this.stripe = null;
  }
}
