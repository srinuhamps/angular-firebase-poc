import { Component, signal, inject } from '@angular/core';
import { MediaService } from '../../core/services/media.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { MediaItem } from '../../core/models/media-item.model';

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

  items     = signal<MediaItem[]>([]);
  loading   = signal(true);
  uploading = signal(false);
  progress  = signal(0);
  uploadErr = signal('');
  copied    = signal<string | null>(null); // id of item whose link was just copied

  // Form state
  title     = signal('');
  file      = signal<File | null>(null);
  preview   = signal<string | null>(null);

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

  async upload(): Promise<void> {
    const f = this.file();
    if (!f || !this.title().trim()) return;
    this.uploading.set(true);
    this.uploadErr.set('');
    this.progress.set(0);
    try {
      const item = await this.mediaSvc.upload(f, this.title().trim(), (pct) =>
        this.progress.set(pct)
      );
      this.items.update((list) => [item, ...list]);
      this.title.set('');
      this.file.set(null);
      this.preview.set(null);
      // Reset file input via DOM
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
}
