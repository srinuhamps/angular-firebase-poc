import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** Renders the confirm button in danger (red) styling. */
  danger?: boolean;
}

interface PendingConfirm {
  opts:     Required<Omit<ConfirmOptions, 'title' | 'danger'>> & Pick<ConfirmOptions, 'title' | 'danger'>;
  resolve:  (ok: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);

  /**
   * Show a modal confirm dialog. Resolves to true when the user confirms,
   * false when they cancel / dismiss.
   */
  ask(opts: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.pending.set({
        opts: {
          title:       opts.title,
          message:     opts.message,
          confirmText: opts.confirmText ?? 'Confirm',
          cancelText:  opts.cancelText  ?? 'Cancel',
          danger:      opts.danger,
        },
        resolve,
      });
    });
  }

  resolve(ok: boolean): void {
    const p = this.pending();
    if (!p) return;
    this.pending.set(null);
    p.resolve(ok);
  }
}
