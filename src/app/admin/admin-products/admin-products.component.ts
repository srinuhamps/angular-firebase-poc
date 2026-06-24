import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductsService } from '../../core/services/products.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
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
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast      = inject(ToastService);

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
    const prd = this.products().find((p) => p.id === id);
    const ok = await this.confirmSvc.ask({
      title:       'Delete product?',
      message:     `“${prd?.name ?? 'This product'}” will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete',
      danger:      true,
    });
    if (!ok) return;
    this.deleting.set(id);
    try {
      await this.prdService.delete(id);
      this.toast.success(`Deleted “${prd?.name ?? 'product'}”.`);
      this.load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Could not delete product: ' + msg);
    } finally {
      this.deleting.set(null);
    }
  }
}
