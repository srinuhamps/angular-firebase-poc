import { Component, OnInit, AfterViewInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SalonDataService } from '../../core/services/salon-data.service';
import { ScrollAnimationService } from '../../core/services/scroll-animation.service';
import { Product, ProductCategory } from '../../core/models/product.model';
import { ProductCardComponent } from '../../shared/components/product-card/product-card.component';

type FilterCat = ProductCategory | 'all';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [RouterLink, ProductCardComponent],
  templateUrl: './products-page.component.html',
  styleUrl: './products-page.component.scss',
})
export class ProductsPageComponent implements OnInit, AfterViewInit {
  private dataService  = inject(SalonDataService);
  private scrollAnim   = inject(ScrollAnimationService);

  allProducts = signal<Product[]>([]);
  activeFilter = signal<FilterCat>('all');

  readonly filters: { label: string; value: FilterCat }[] = [
    { label: 'All Products',   value: 'all'           },
    { label: 'Hair Care',      value: 'hair-care'     },
    { label: 'Braiding Hair',  value: 'braiding-hair' },
    { label: 'Extensions',     value: 'extensions'    },
    { label: 'Styling',        value: 'styling'       },
    { label: 'Tools',          value: 'tools'         },
    { label: 'Accessories',    value: 'accessories'   },
  ];

  filteredProducts = computed<Product[]>(() => {
    const f = this.activeFilter();
    const all = this.allProducts();
    return f === 'all' ? all : all.filter(p => p.category === f);
  });

  ngOnInit(): void {
    this.dataService.getProducts().subscribe({
      next: (p) => {
        this.allProducts.set(p);
        // Data arrived after ngAfterViewInit ran — observe the freshly rendered cards.
        setTimeout(() => this.scrollAnim.observeAll(), 0);
      },
      error: (err) => console.error('[ProductsPage] getProducts failed', err),
    });
  }

  ngAfterViewInit(): void {
    this.scrollAnim.observeAll();
  }

  setFilter(f: FilterCat): void {
    this.activeFilter.set(f);
    setTimeout(() => this.scrollAnim.observeAll(), 50);
  }
}
