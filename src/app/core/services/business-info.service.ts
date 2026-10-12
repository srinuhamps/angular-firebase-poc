import { Injectable, inject, signal } from '@angular/core';
import {
  Firestore,
  doc,
  setDoc,
  getDoc,
} from '@angular/fire/firestore';
import { Observable, ReplaySubject, from, of } from 'rxjs';
import { catchError, shareReplay, switchMap, tap } from 'rxjs/operators';

import { BusinessInfo } from '../models/business-info.model';

const DOC_PATH = 'config/business';

/** Whether the last read came from Firestore or the document is missing. */
export type BusinessInfoSource = 'unknown' | 'firestore' | 'missing';

/**
 * BusinessInfoService
 *
 * Single source of truth for the salon's business profile (hours, address,
 * phone, holidays, social, etc.). Reads/writes the Firestore document at
 * `config/business`. If the document does not yet exist, subscribers receive
 * `null` — there are no built-in defaults. The Admin → Business Settings
 * page is the only place that mutates this data.
 *
 * Reads use `getDoc` (one-shot) rather than `docData` (realtime listener).
 * The public site and admin form don't need instant push updates, and one-shot
 * reads avoid the cold-start emission quirks we saw with the realtime listener
 * (the initial value sometimes arrived as `undefined` and never got replaced,
 * leaving the admin form blank even though the doc existed). A manual
 * `refresh$.next()` after every save re-fetches so the UI stays in sync.
 */
@Injectable({ providedIn: 'root' })
export class BusinessInfoService {
  private readonly firestore = inject(Firestore);

  /** Re-fetch trigger — `next()` to force a fresh read. */
  private readonly refresh$ = new ReplaySubject<void>(1);

  /** Diagnostic signal exposing where the current `info$` value came from. */
  readonly source = signal<BusinessInfoSource>('unknown');

  /**
   * Live stream of the current BusinessInfo, or `null` if the Firestore
   * document `config/business` has not been created yet. Shared across
   * all subscribers.
   */
  readonly info$: Observable<BusinessInfo | null> = this.refresh$.pipe(
    switchMap(() => this.read()),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  constructor() {
    // Prime the stream so subscribers get an initial value.
    this.refresh$.next();
  }

  /** Convenience getter — same observable as `info$`. */
  get(): Observable<BusinessInfo | null> {
    return this.info$;
  }

  /** Force a fresh read from Firestore (used after external writes). */
  refresh(): void {
    this.refresh$.next();
  }

  /**
   * One-shot read that bypasses the cached observable. Returns the raw
   * document data so admin diagnostics can show exactly what Firestore
   * holds. Returns `null` if the doc is missing.
   */
  async peekRaw(): Promise<Partial<BusinessInfo> | null> {
    const ref = doc(this.firestore, DOC_PATH);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as Partial<BusinessInfo>;
  }

  /** Persist changes and refresh the stream. */
  async save(info: BusinessInfo): Promise<void> {
    const ref = doc(this.firestore, DOC_PATH);
    // Strip undefined values — Firestore rejects them. Also strip `id` because
    // it's not part of the persisted schema (the doc path IS the id).
    const payload = this.stripUndefined({ ...info, id: 'business' });
    console.info('[BusinessInfoService] save →', payload);
    await setDoc(ref, payload);
    console.info('[BusinessInfoService] save complete');
    this.refresh$.next();
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private read(): Observable<BusinessInfo | null> {
    const ref = doc(this.firestore, DOC_PATH);
    return from(getDoc(ref)).pipe(
      switchMap((snap) => {
        if (snap.exists()) {
          const data = snap.data() as BusinessInfo;
          console.info('[BusinessInfoService] read ← firestore', data);
          this.source.set('firestore');
          return of(data);
        }
        console.warn(
          '[BusinessInfoService] config/business does not exist. ' +
          'Save any change in Admin → Settings to create the document.'
        );
        this.source.set('missing');
        return of(null);
      }),
      catchError((err) => {
        console.error('[BusinessInfoService] read failed', err);
        this.source.set('missing');
        return of(null);
      }),
      tap((v) => console.info('[BusinessInfoService] emit', v))
    );
  }

  /**
   * Firestore rejects any field whose value is `undefined`. Recursively drop
   * such fields so `setDoc` doesn't throw on optional interface members
   * (twitterUrl, tiktokUrl, mapEmbedUrl, holiday open/close, etc.).
   */
  private stripUndefined<T>(value: T): T {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value)) {
      return value.map((v) => this.stripUndefined(v)) as unknown as T;
    }
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === undefined) continue;
        out[k] = this.stripUndefined(v);
      }
      return out as T;
    }
    return value;
  }
}
