import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { ProductsService } from '../../../core/services/products.service';
import { Product, ProductCategory } from '../../../core/models/product.model';
import { MediaPickerComponent } from '../../media-picker/media-picker.component';

type FormData = Omit<Product, 'id'>;

const EMPTY_FORM: FormData = {
  name: '',
  brand: '',
  category: 'hair-care',
  shortDescription: '',
  description: '',
  price: 0,
  imageUrl: '',
  inStock: true,
  stockQuantity: 0,
  isFeatured: false,
  tags: [],
  sortOrder: 0,
};

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [FormsModule, MediaPickerComponent],
  templateUrl: './product-form.component.html',
  styleUrl: './product-form.component.scss',
})
export class ProductFormComponent implements OnInit {
  private readonly prdService  = inject(ProductsService);
  private readonly route       = inject(ActivatedRoute);
  private readonly router      = inject(Router);

  private originalForm: FormData = { ...EMPTY_FORM };
  private originalTagsRaw = '';

  editId           = signal<string | null>(null);
  form             = signal<FormData>({ ...EMPTY_FORM });
  saving           = signal<boolean>(false);
  error            = signal<string>('');
  tagsRaw          = signal<string>('');
  showCancelDialog = signal(false);

  readonly categories: ProductCategory[] = [
    'hair-care', 'braiding-hair', 'extensions', 'styling', 'tools', 'accessories',
  ];

  isDirty(): boolean {
    return (
      JSON.stringify(this.form()) !== JSON.stringify(this.originalForm) ||
      this.tagsRaw() !== this.originalTagsRaw
    );
  }

  cancel(): void {
    if (this.isDirty()) {
      this.showCancelDialog.set(true);
    } else {
      this.router.navigate(['/admin/products']);
    }
  }

  confirmCancel(): void {
    this.router.navigate(['/admin/products']);
  }

  dismissDialog(): void {
    this.showCancelDialog.set(false);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      this.prdService.getAll().pipe(
        map((list) => list.find((p) => p.id === id))
      ).subscribe((prd) => {
        if (prd) {
          const { id: _id, ...data } = prd as Product;
          this.form.set({ ...data });
          this.tagsRaw.set(prd.tags.join(', '));
          this.originalForm    = { ...data };
          this.originalTagsRaw = prd.tags.join(', ');
        }
      });
    }
  }

  async save(): Promise<void> {
    const data = this.form();
    if (!data.name || !data.shortDescription) {
      this.error.set('Name and short description are required.');
      return;
    }
    this.error.set('');
    this.saving.set(true);
    data.tags = this.tagsRaw().split(',').map((t) => t.trim()).filter(Boolean);
    try {
      const id = this.editId();
      if (id) {
        await this.prdService.update(id, data);
      } else {
        await this.prdService.add(data);
      }
      this.router.navigate(['/admin/products']);
    } catch {
      this.error.set('Save failed. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  setField<K extends keyof FormData>(key: K, value: FormData[K]): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }
}
