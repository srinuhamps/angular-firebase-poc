import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MediaService } from '../../core/services/media.service';
import { MediaCategory, MediaItem } from '../../core/models/media-item.model';

/**
 * Multi-image picker for admin forms.
 * Browses the media library (filtered by category) and lets the admin build an
 * ordered list of image URLs.  The first URL is treated as the cover/thumbnail.
 *
 * Emits `valueChange` with the updated `string[]` whenever the list changes.
 */
@Component({
  selector: 'app-multi-media-picker',
  standalone: true,
  templateUrl: './multi-media-picker.component.html',
  styleUrl:    './multi-media-picker.component.scss',
})
export class MultiMediaPickerComponent {
  private readonly mediaSvc = inject(MediaService);

  /** Which storage category to browse. */
  readonly category = input.required<MediaCategory>();
  /** Currently selected URLs (in display order; first = cover). */
  readonly value    = input<string[]>([]);
  /** Human label shown in the section header. */
  readonly label    = input<string>('Images');

  /** Emitted whenever the ordered list changes. */
  readonly valueChange = output<string[]>();

  readonly open      = signal(false);
  readonly loading   = signal(false);
  readonly items     = signal<MediaItem[]>([]);
  readonly errorMsg  = signal('');
  readonly search    = signal('');

  readonly filteredItems = computed<MediaItem[]>(() => {
    const q = this.search().trim().toLowerCase();
    return q
      ? this.items().filter((i) => i.title.toLowerCase().includes(q))
      : this.items();
  });

  /** True if a given URL is already selected. */
  isSelected(url: string): boolean {
    return this.value().includes(url);
  }

  openPicker(): void {
    this.open.set(true);
    this.errorMsg.set('');
    this.loadItems();
  }

  closePicker(): void {
    this.open.set(false);
  }

  private loadItems(): void {
    this.loading.set(true);
    const wanted = this.category();
    this.mediaSvc.getAll().subscribe({
      next: (all) => {
        this.items.set(all.filter((i) => i.categories.includes(wanted)));
        this.loading.set(false);
      },
      error: () => {
        this.errorMsg.set('Failed to load images. Please try again.');
        this.loading.set(false);
      },
    });
  }

  toggle(item: MediaItem): void {
    const current = this.value();
    const next = current.includes(item.url)
      ? current.filter((u) => u !== item.url)
      : [...current, item.url];
    this.valueChange.emit(next);
  }

  remove(url: string): void {
    this.valueChange.emit(this.value().filter((u) => u !== url));
  }

  moveUp(index: number): void {
    if (index === 0) return;
    const arr = [...this.value()];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    this.valueChange.emit(arr);
  }

  moveDown(index: number): void {
    const arr = this.value();
    if (index === arr.length - 1) return;
    const next = [...arr];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    this.valueChange.emit(next);
  }

  onManualUrlAdd(url: string): void {
    const trimmed = url.trim();
    if (!trimmed || this.value().includes(trimmed)) return;
    this.valueChange.emit([...this.value(), trimmed]);
  }
}
