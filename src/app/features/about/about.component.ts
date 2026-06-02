import { Component, AfterViewInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalonDataService } from '../../core/services/salon-data.service';
import { ScrollAnimationService } from '../../core/services/scroll-animation.service';
import { Stylist } from '../../core/models/stylist.model';
import { SectionTitleComponent } from '../../shared/components/section-title/section-title.component';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [RouterLink, SectionTitleComponent],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss',
})
export class AboutComponent implements AfterViewInit {
  private dataService = inject(SalonDataService);
  private scrollAnim  = inject(ScrollAnimationService);

  stylists: Stylist[] = [];

  readonly values = [
    { title: 'Excellence',   desc: 'Every style is crafted with precision and artistry. We never compromise on quality.' },
    { title: 'Care',         desc: 'Your hair health is our priority. We use only premium, nourishing products.' },
    { title: 'Inclusivity',  desc: 'Every texture, every style, every person. You belong here exactly as you are.' },
    { title: 'Community',    desc: "We're more than a salon. We're a gathering place for beauty, culture, and confidence." },
  ];

  constructor() {
    this.dataService.getStylists().subscribe(s => (this.stylists = s));
  }

  ngAfterViewInit(): void {
    this.scrollAnim.observeAll();
  }
}
