import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
  /** Auto-dismiss in ms. 0 = sticky. */
  durationMs: number;
}

interface ShowOptions {
  title?: string;
  /** Auto-dismiss in ms. Defaults: success=3500, info=4000, warning=5000, error=6500. */
  durationMs?: number;
}

const DEFAULT_DURATIONS: Record<ToastKind, number> = {
  success: 3500,
  info:    4000,
  warning: 5000,
  error:   6500,
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  success(message: string, opts: ShowOptions = {}): number { return this.push('success', message, opts); }
  error  (message: string, opts: ShowOptions = {}): number { return this.push('error',   message, opts); }
  info   (message: string, opts: ShowOptions = {}): number { return this.push('info',    message, opts); }
  warning(message: string, opts: ShowOptions = {}): number { return this.push('warning', message, opts); }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(kind: ToastKind, message: string, opts: ShowOptions): number {
    const id = this.nextId++;
    const durationMs = opts.durationMs ?? DEFAULT_DURATIONS[kind];
    this.toasts.update((list) => [
      ...list,
      { id, kind, message, title: opts.title, durationMs },
    ]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
    return id;
  }
}
