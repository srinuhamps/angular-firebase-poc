import { Component, signal, computed, inject } from '@angular/core';
import { MediaService } from '../../core/services/media.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { MediaItem, MediaCategory } from '../../core/models/media-item.model';

type CategoryFilter = MediaCategory | 'all';

@Component({
  selector: 'app-admin-gallery',
  standalone: true,
  imports: [],
  templateUrl: './admin-gallery.component.html',
  styleUrl: './admin-gallery.component.scss',
})
export class AdminGalleryComponent {
  private readonly mediaSvc   = inject(MediaService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast      = inject(ToastService);

  /** All category options in canonical order — used by the upload checkboxes,
   *  the retro-edit dialog, and the badges on cards. */
  readonly ALL_CATEGORIES: readonly MediaCategory[] = ['gallery', 'product', 'service', 'internal'];

  items     = signal<MediaItem[]>([]);
  loading   = signal(true);
  uploading = signal(false);
  progress  = signal(0);
  uploadErr = signal('');
  copied    = signal<string | null>(null); // id of item whose link was just copied

  // Upload form state
  title    = signal('');
  file     = signal<File | null>(null);
  preview  = signal<string | null>(null);
  /** Which buckets the next upload will be filed under (checkboxes).
   *  Default: Gallery only — matches the previous single-radio behavior. */
  categories = signal<MediaCategory[]>(['gallery']);

  // Grid filter — tabs above the grid
  filter = signal<CategoryFilter>('all');

  // Retro-edit dialog state
  editingItem       = signal<MediaItem | null>(null);
  editingTitle      = signal('');
  editingCategories = signal<MediaCategory[]>([]);
  savingEdit        = signal(false);

  // In-place file replacement
  replacingId = signal<string | null>(null);

  // Full-size viewer (lightbox) state
  viewingItem = signal<MediaItem | null>(null);

  readonly filteredItems = computed(() => {
    const f = this.filter();
    return f === 'all'
      ? this.items()
      : this.items().filter((i) => i.categories.includes(f));
  });

  readonly counts = computed(() => {
    const list = this.items();
    return {
      all:      list.length,
      gallery:  list.filter((i) => i.categories.includes('gallery')).length,
      product:  list.filter((i) => i.categories.includes('product')).length,
      service:  list.filter((i) => i.categories.includes('service')).length,
      internal: list.filter((i) => i.categories.includes('internal')).length,
    };
  });

  /** Template-safe count lookup — template's dynamic tab.value is typed as `string`. */
  countFor(key: string): number {
    return this.counts()[key as CategoryFilter] ?? 0;
  }

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.mediaSvc.getAll().subscribe({
      next:  (items) => { this.items.set(items); this.loading.set(false); },
      error: ()      => this.loading.set(false),
    });
  }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    this.file.set(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = (e) => this.preview.set(e.target?.result as string);
      reader.readAsDataURL(f);
      // Pre-fill title from filename if empty
      if (!this.title()) {
        this.title.set(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
      }
    } else {
      this.preview.set(null);
    }
  }

  /** Toggle a category on the upload form. Guards against unchecking the last one.
   *  `internal` is exclusive — checking it clears the others and vice versa. */
  toggleUploadCategory(cat: MediaCategory, checked: boolean): void {
    this.categories.update((list) => {
      if (checked) {
        if (cat === 'internal') return ['internal'];
        const next = list.filter((c) => c !== 'internal');
        return next.includes(cat) ? next : [...next, cat];
      }
      const next = list.filter((c) => c !== cat);
      return next.length === 0 ? list : next; // never allow zero
    });
  }

  isUploadCategoryChecked(cat: MediaCategory): boolean {
    return this.categories().includes(cat);
  }

  async upload(): Promise<void> {
    const f = this.file();
    if (!f || !this.title().trim()) return;
    if (this.categories().length === 0) {
      this.uploadErr.set('Pick at least one category.');
      return;
    }
    this.uploading.set(true);
    this.uploadErr.set('');
    this.progress.set(0);
    try {
      const item = await this.mediaSvc.upload(
        f,
        this.title().trim(),
        this.categories(),
        (pct) => this.progress.set(pct)
      );
      this.items.update((list) => [item, ...list]);
      this.title.set('');
      this.file.set(null);
      this.preview.set(null);
      // Keep the same categories selected — most admins upload in bursts of the same type.
      const input = document.getElementById('gallery-file-input') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (e: unknown) {
      this.uploadErr.set(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      this.uploading.set(false);
      this.progress.set(0);
    }
  }

  async copyLink(item: MediaItem): Promise<void> {
    await navigator.clipboard.writeText(item.url);
    this.copied.set(item.id);
    setTimeout(() => this.copied.update((v) => (v === item.id ? null : v)), 2000);
  }

  async deleteItem(item: MediaItem): Promise<void> {
    const ok = await this.confirmSvc.ask({
      title:       'Delete media?',
      message:     `“${item.title}” will be permanently removed from the gallery and Storage. This cannot be undone.`,
      confirmText: 'Delete',
      danger:      true,
    });
    if (!ok) return;
    try {
      await this.mediaSvc.delete(item);
      this.items.update((list) => list.filter((i) => i.id !== item.id));
      this.toast.success(`Deleted “${item.title}”.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Could not delete media: ' + msg);
    }
  }

  // ─── Full-size viewer (lightbox) ────────────────────────────────────

  openViewer(item: MediaItem): void {
    this.viewingItem.set(item);
    document.body.style.overflow = 'hidden';
  }

  closeViewer(): void {
    this.viewingItem.set(null);
    document.body.style.overflow = '';
  }

  // ─── In-place file replacement (inside the Edit dialog) ──────

  /** Opens the hidden file input in the Edit dialog. */
  startReplace(): void {
    const input = document.getElementById('replace-input') as HTMLInputElement | null;
    input?.click();
  }

  async onReplaceFile(item: MediaItem, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.replacingId.set(item.id);
    try {
      await this.mediaSvc.replaceImage(item, file);
      this.toast.success(`Replaced "${item.title}" — the link is unchanged.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Could not replace image: ' + msg);
    } finally {
      this.replacingId.set(null);
    }
  }

  // ─── Retro-edit dialog ─────────────────────────────────────────

  openEditDialog(item: MediaItem): void {
    this.editingItem.set(item);
    this.editingTitle.set(item.title);
    this.editingCategories.set([...item.categories]);
  }

  closeEditDialog(): void {
    this.editingItem.set(null);
    this.editingTitle.set('');
    this.editingCategories.set([]);
    this.savingEdit.set(false);
    this.replacingId.set(null);
  }

  toggleEditCategory(cat: MediaCategory, checked: boolean): void {
    this.editingCategories.update((list) => {
      if (checked) {
        if (cat === 'internal') return ['internal'];
        const next = list.filter((c) => c !== 'internal');
        return next.includes(cat) ? next : [...next, cat];
      }
      const next = list.filter((c) => c !== cat);
      return next.length === 0 ? list : next; // must keep at least one
    });
  }

  isEditCategoryChecked(cat: MediaCategory): boolean {
    return this.editingCategories().includes(cat);
  }

  async saveEdits(): Promise<void> {
    const item = this.editingItem();
    if (!item) return;
    const next  = this.editingCategories();
    const title = this.editingTitle().trim();
    if (next.length === 0 || !title) return;
    this.savingEdit.set(true);
    try {
      await this.mediaSvc.updateItem(item.id, title, next);
      this.items.update((list) =>
        list.map((i) => (i.id === item.id ? { ...i, title, categories: next } : i))
      );
      this.toast.success(`Updated “${title}”.`);
      this.closeEditDialog();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Could not update media: ' + msg);
      this.savingEdit.set(false);
    }
  }
}
