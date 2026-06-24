import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StylistsService } from '../../core/services/stylists.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { Stylist } from '../../core/models/stylist.model';

@Component({
  selector: 'app-admin-stylists',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-stylists.component.html',
  styleUrl: './admin-stylists.component.scss',
})
export class AdminStylistsComponent {
  private readonly styService = inject(StylistsService);
  private readonly confirmSvc = inject(ConfirmService);
  private readonly toast      = inject(ToastService);

  stylists = signal<Stylist[]>([]);
  loading  = signal<boolean>(true);
  deleting = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.styService.getAll().subscribe((s) => {
      this.stylists.set(s);
      this.loading.set(false);
    });
  }

  async toggleAvailable(sty: Stylist): Promise<void> {
    await this.styService.update(sty.id, { isAvailable: !sty.isAvailable });
    this.load();
  }

  async delete(id: string): Promise<void> {
    const sty = this.stylists().find((s) => s.id === id);
    const ok = await this.confirmSvc.ask({
      title:       'Delete stylist?',
      message:     `“${sty?.name ?? 'This stylist'}” will be permanently removed. This cannot be undone.`,
      confirmText: 'Delete',
      danger:      true,
    });
    if (!ok) return;
    this.deleting.set(id);
    try {
      await this.styService.delete(id);
      this.toast.success(`Deleted “${sty?.name ?? 'stylist'}”.`);
      this.load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Could not delete stylist: ' + msg);
    } finally {
      this.deleting.set(null);
    }
  }
}
