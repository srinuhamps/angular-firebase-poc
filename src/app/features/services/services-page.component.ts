import { Component, ElementRef, OnInit, AfterViewInit, ViewChild, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalonDataService } from '../../core/services/salon-data.service';
import { ScrollAnimationService } from '../../core/services/scroll-animation.service';
import { HairService, SERVICE_CATEGORIES, labelForCategory } from '../../core/models/hair-service.model';
import { ServiceCardComponent } from '../../shared/components/service-card/service-card.component';

@Component({
  selector: 'app-services-page',
  standalone: true,
  imports: [RouterLink, ServiceCardComponent],
  templateUrl: './services-page.component.html',
  styleUrl: './services-page.component.scss',
})
export class ServicesPageComponent implements OnInit, AfterViewInit {
  @ViewChild('servicesSection') servicesSectionRef?: ElementRef<HTMLElement>;

  private dataService = inject(SalonDataService);
  private scrollAnim  = inject(ScrollAnimationService);

  allServices      = signal<HairService[]>([]);
  searchQuery      = signal<string>('');
  selectedCategory = signal<string | null>(null);

  readonly labelForCategory = labelForCategory;

  readonly isSearching = computed(() => this.searchQuery().trim().length > 0);

  /** Services that match the current search query (name, description, tags, category). */
  readonly searchResults = computed<HairService[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return [];
    return this.allServices().filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.shortDescription ?? '').toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q) ||
      labelForCategory(s.category).toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q) ||
      (s.tags ?? []).some(t => t.toLowerCase().includes(q))
    );
  });

  /** Category cards — when searching, counts reflect matching results only. */
  readonly availableCategories = computed(() => {
    const base = this.isSearching() ? this.searchResults() : this.allServices();
    const seen = new Map<string, number>();
    for (const s of base) seen.set(s.category, (seen.get(s.category) ?? 0) + 1);
    return SERVICE_CATEGORIES
      .filter(c => seen.has(c.value))
      .map(c => ({ value: c.value, label: c.label, count: seen.get(c.value)! }));
  });

  readonly selectedCategoryLabel = computed<string>(() => {
    const cat = this.selectedCategory();
    if (!cat || cat === 'all') return 'All Services';
    return labelForCategory(cat);
  });

  readonly selectedCategoryCount = computed<number>(() => {
    const cat = this.selectedCategory();
    if (!cat) return 0;
    // Base is search results when searching, otherwise all services
    const base = this.isSearching() ? this.searchResults() : this.allServices();
    if (cat === 'all') return base.length;
    return base.filter(s => s.category === cat).length;
  });

  /** Final service list: apply search filter first, then category filter. */
  filteredServices = computed<HairService[]>(() => {
    const isSearch = this.isSearching();
    const cat = this.selectedCategory();
    if (!isSearch && cat === null) return [];

    let results = isSearch ? this.searchResults() : this.allServices();
    if (cat && cat !== 'all') results = results.filter(s => s.category === cat);
    return results;
  });

  readonly showGrid = computed(() => this.isSearching() || this.selectedCategory() !== null);

  ngOnInit(): void {
    this.dataService.getServices().subscribe({
      next: (s) => {
        this.allServices.set(s);
        setTimeout(() => this.scrollAnim.observeAll(), 0);
      },
      error: (err) => console.error('[ServicesPage] getServices failed', err),
    });
  }

  ngAfterViewInit(): void {
    this.scrollAnim.observeAll();
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
    // Clear category when starting a new search so results aren't doubly filtered.
    // User can then click a category card to narrow down search results.
    this.selectedCategory.set(null);
    setTimeout(() => this.scrollAnim.observeAll(), 60);
    // No auto-scroll — results appear below the category grid inline.
  }

  clearSearch(): void {
    this.searchQuery.set('');
    setTimeout(() => this.scrollAnim.observeAll(), 50);
  }

  selectCategory(cat: string): void {
    this.selectedCategory.set(cat);
    setTimeout(() => {
      // Only scroll to the grid when browsing by category without an active search.
      // During search the results are already in view below the category grid.
      if (!this.isSearching()) {
        this.servicesSectionRef?.nativeElement
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      this.scrollAnim.observeAll();
    }, 60);
  }

  clearCategory(): void {
    this.selectedCategory.set(null);
    setTimeout(() => this.scrollAnim.observeAll(), 50);
  }
}
