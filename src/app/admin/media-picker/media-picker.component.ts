import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MediaService } from '../../core/services/media.service';
import {
  MediaCategory,
  MediaItem,
} from '../../core/models/media-item.model';

/**
 * Reusable image picker for admin forms.
 * Browses the `media` collection filtered by the given category
 * (typically `'product'` or `'service'`) and emits the selected
 * image's public download URL.
 */
@Component({
  selector: 'app-media-picker',
  standalone: true,
  templateUrl: './media-picker.component.html',
  styleUrl: './media-picker.component.scss',
})
export class MediaPickerComponent {
  private readonly mediaSvc = inject(MediaService);

  /** Which storage bucket to browse. */
  readonly category = input.required<MediaCategory>();
  /** Currently selected image URL (empty string = none). */
  readonly value    = input<string>('');
  /** Human label shown next to the picker (e.g. "Product Image"). */
  readonly label    = input<string>('Image');

  /** Emitted whenever the user picks or clears the image URL. */
  readonly valueChange = output<string>();

  readonly open      = signal<boolean>(false);
  readonly loading   = signal<boolean>(false);
  readonly items     = signal<MediaItem[]>([]);
  readonly errorMsg  = signal<string>('');
  readonly search    = signal<string>('');

  readonly filteredItems = computed<MediaItem[]>(() => {
    const q = this.search().trim().toLowerCase();
    const list = this.items();
    if (!q) return list;
    return list.filter((i) => i.title.toLowerCase().includes(q));
  });

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

  select(item: MediaItem): void {
    this.valueChange.emit(item.url);
    this.closePicker();
  }

  clear(): void {
    this.valueChange.emit('');
  }

  onManualUrlChange(url: string): void {
    this.valueChange.emit(url);
  }
}
