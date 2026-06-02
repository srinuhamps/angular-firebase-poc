import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductsService } from '../../core/services/products.service';
import { Product } from '../../core/models/product.model';

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-products.component.html',
  styleUrl: './admin-products.component.scss',
})
export class AdminProductsComponent {
  private readonly prdService = inject(ProductsService);

  products = signal<Product[]>([]);
  loading  = signal<boolean>(true);
  deleting = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.prdService.getAll().subscribe((p) => {
      this.products.set(p);
      this.loading.set(false);
    });
  }

  async toggleStock(prd: Product): Promise<void> {
    await this.prdService.update(prd.id, { inStock: !prd.inStock });
    this.load();
  }

  async delete(id: string): Promise<void> {
    if (!confirm('Delete this product? This cannot be undone.')) return;
    this.deleting.set(id);
    try {
      await this.prdService.delete(id);
      this.load();
    } finally {
      this.deleting.set(null);
    }
  }
}
