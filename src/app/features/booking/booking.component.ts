import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.scss',
})
export class BookingComponent {
  // Phase 2: Replace with full multi-step booking flow
  // Steps: Select Service → Select Stylist → Pick Date/Time → Your Details → Confirm & Pay

  readonly steps = [
    { num: '01', label: 'Select Service'   },
    { num: '02', label: 'Choose Stylist'   },
    { num: '03', label: 'Pick Date & Time' },
    { num: '04', label: 'Your Details'     },
    { num: '05', label: 'Confirm & Pay'    },
  ];
}
