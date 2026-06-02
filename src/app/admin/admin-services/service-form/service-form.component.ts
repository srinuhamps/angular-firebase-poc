import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { ServicesService } from '../../../core/services/services.service';
import { HairService, ServiceCategory } from '../../../core/models/hair-service.model';

type FormData = Omit<HairService, 'id'>;

const EMPTY_FORM: FormData = {
  name: '',
  category: 'braiding',
  shortDescription: '',
  description: '',
  price: 0,
  duration: 60,
  imageUrl: '',
  isAvailable: true,
  isFeatured: false,
  bookingEnabled: true,
  tags: [],
  sortOrder: 0,
};

@Component({
  selector: 'app-service-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './service-form.component.html',
  styleUrl: './service-form.component.scss',
})
export class ServiceFormComponent implements OnInit {
  private readonly svcService  = inject(ServicesService);
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

  readonly categories: ServiceCategory[] = [
    'braiding', 'locs', 'weaving', 'styling', 'kids', 'consultation',
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
      this.router.navigate(['/admin/services']);
    }
  }

  confirmCancel(): void {
    this.router.navigate(['/admin/services']);
  }

  dismissDialog(): void {
    this.showCancelDialog.set(false);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      this.svcService.getAll().pipe(
        map((list) => list.find((s) => s.id === id))
      ).subscribe((svc) => {
        if (svc) {
          const { id: _id, ...data } = svc as HairService;
          this.form.set({ ...data });
          this.tagsRaw.set(svc.tags.join(', '));
          this.originalForm    = { ...data };
          this.originalTagsRaw = svc.tags.join(', ');
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
        await this.svcService.update(id, data);
      } else {
        await this.svcService.add(data);
      }
      this.router.navigate(['/admin/services']);
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
