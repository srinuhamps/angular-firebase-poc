import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-section-title',
  standalone: true,
  template: `
    <div class="section-title" [class.centered]="centered">
      @if (eyebrow) {
        <span class="section-title__eyebrow">{{ eyebrow }}</span>
      }
      <h2 class="section-title__heading">{{ heading }}</h2>
      @if (subheading) {
        <p class="section-title__sub">{{ subheading }}</p>
      }
      <span class="section-title__line" [class.center-line]="centered"></span>
    </div>
  `,
  styleUrl: './section-title.component.scss',
})
export class SectionTitleComponent {
  @Input() eyebrow   = '';
  @Input() heading   = '';
  @Input() subheading = '';
  @Input() centered  = false;
  @Input() light     = false;  // light text variant for dark backgrounds
}
