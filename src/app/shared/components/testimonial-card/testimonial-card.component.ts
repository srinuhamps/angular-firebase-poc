import { Component, Input } from '@angular/core';
import { Testimonial } from '../../../core/models/testimonial.model';

@Component({
  selector: 'app-testimonial-card',
  standalone: true,
  templateUrl: './testimonial-card.component.html',
  styleUrl: './testimonial-card.component.scss',
})
export class TestimonialCardComponent {
  @Input({ required: true }) testimonial!: Testimonial;

  get stars(): number[] {
    return Array.from({ length: this.testimonial.rating }, (_, i) => i);
  }

  get emptyStars(): number[] {
    return Array.from({ length: 5 - this.testimonial.rating }, (_, i) => i);
  }
}
