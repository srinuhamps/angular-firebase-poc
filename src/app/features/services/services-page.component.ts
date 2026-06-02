import { Component, OnInit, AfterViewInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalonDataService } from '../../core/services/salon-data.service';
import { ScrollAnimationService } from '../../core/services/scroll-animation.service';
import { HairService, ServiceCategory } from '../../core/models/hair-service.model';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';

type FilterCategory = ServiceCategory | 'all';

@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [RouterLink, ServiceCardComponent],
  templateUrl: './services-page.component.html',
  styleUrl: './services-page.component.scss',
})
export class ServicesPageComponent implements OnInit, AfterViewInit {
  private dataService  = inject(SalonDataService);
  private scrollAnim   = inject(ScrollAnimationService);

  allServices: HairService[] = [];
  activeFilter = signal<FilterCategory>('all');

  readonly filters: { label: string; value: FilterCategory }[] = [
    { label: 'All Services',   value: 'all'          },
    { label: 'Braiding',       value: 'braiding'     },
    { label: 'Locs',           value: 'locs'         },
    { label: 'Weaving',        value: 'weaving'      },
    { label: 'Styling',        value: 'styling'      },
    { label: 'Kids',           value: 'kids'         },
    { label: 'Consultation',   value: 'consultation' },
  ];

  get filteredServices(): HairService[] {
    const f = this.activeFilter();
    return f === 'all' ? this.allServices : this.allServices.filter(s => s.category === f);
  }

  ngOnInit(): void {
    this.dataService.getServices().subscribe(s => (this.allServices = s));
  }

  ngAfterViewInit(): void {
    this.scrollAnim.observeAll();
  }

  setFilter(f: FilterCategory): void {
    this.activeFilter.set(f);
    setTimeout(() => this.scrollAnim.observeAll(), 50);
  }
}
