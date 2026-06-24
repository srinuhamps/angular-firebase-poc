import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { StylistsService } from '../../../core/services/stylists.service';
import { Stylist } from '../../../core/models/stylist.model';

type FormData = Omit<Stylist, 'id'>;

const EMPTY_FORM: FormData = {
  name: '',
  title: '',
  bio: '',
  imageUrl: '',
  specialties: [],
  yearsExperience: 0,
  isAvailable: true,
  instagramUrl: '',
};

@Component({
  selector: 'app-stylist-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './stylist-form.component.html',
  styleUrl: './stylist-form.component.scss',
})
export class StylistFormComponent implements OnInit {
  private readonly styService = inject(StylistsService);
  private readonly route      = inject(ActivatedRoute);
  private readonly router     = inject(Router);

  private originalForm: FormData = { ...EMPTY_FORM };
  private originalSpecialtiesRaw = '';

  editId           = signal<string | null>(null);
  form             = signal<FormData>({ ...EMPTY_FORM });
  saving           = signal<boolean>(false);
  error            = signal<string>('');
  specialtiesRaw   = signal<string>('');
  showCancelDialog = signal(false);

  isDirty(): boolean {
    return (
      JSON.stringify(this.form()) !== JSON.stringify(this.originalForm) ||
      this.specialtiesRaw() !== this.originalSpecialtiesRaw
    );
  }

  cancel(): void {
    if (this.isDirty()) {
      this.showCancelDialog.set(true);
    } else {
      this.router.navigate(['/admin/stylists']);
    }
  }

  confirmCancel(): void {
    this.router.navigate(['/admin/stylists']);
  }

  dismissDialog(): void {
    this.showCancelDialog.set(false);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editId.set(id);
      this.styService.getAll().pipe(
        map((list) => list.find((s) => s.id === id))
      ).subscribe((sty) => {
        if (sty) {
          const { id: _id, ...data } = sty as Stylist;
          this.form.set({ ...data });
          this.specialtiesRaw.set(sty.specialties.join(', '));
          this.originalForm           = { ...data };
          this.originalSpecialtiesRaw = sty.specialties.join(', ');
        }
      });
    }
  }

  async save(): Promise<void> {
    const data = this.form();
    if (!data.name || !data.title) {
      this.error.set('Name and title are required.');
      return;
    }
    this.error.set('');
    this.saving.set(true);
    data.specialties = this.specialtiesRaw()
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    try {
      const id = this.editId();
      if (id) {
        await this.styService.update(id, data);
      } else {
        await this.styService.add(data);
      }
      this.router.navigate(['/admin/stylists']);
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
