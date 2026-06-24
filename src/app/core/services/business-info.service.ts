import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  doc,
  docData,
  setDoc,
  getDoc,
} from '@angular/fire/firestore';
import { Observable, ReplaySubject, of } from 'rxjs';
import { catchError, shareReplay, switchMap } from 'rxjs/operators';

import { BusinessInfo } from '../models/business-info.model';
import { MOCK_BUSINESS_INFO } from '../../data/mock/business-info.mock';

const DOC_PATH = 'config/business';

/**
 * BusinessInfoService
 *
 * Single source of truth for the salon's business profile (hours, address,
 * phone, holidays, social, etc.). Reads/writes the Firestore document at
 * `config/business`. If the document does not yet exist, the mock seed is
 * returned so the public site keeps rendering. The admin "Business Settings"
 * page is the only place that should mutate this data.
 */
@Injectable({ providedIn: 'root' })
export class BusinessInfoService {
  private readonly firestore = inject(Firestore);

  /** Re-fetch trigger — `next()` to force a fresh read. */
  private readonly refresh$ = new ReplaySubject<void>(1);

  /** Live stream of the current BusinessInfo, shared across all subscribers. */
  readonly info$: Observable<BusinessInfo> = this.refresh$.pipe(
    switchMap(() => this.read()),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  constructor() {
    // Prime the stream so subscribers get an initial value.
    this.refresh$.next();
  }

  /** Convenience getter — same observable as `info$`. */
  get(): Observable<BusinessInfo> {
    return this.info$;
  }

  /** Persist changes and refresh the stream. */
  async save(info: BusinessInfo): Promise<void> {
    const ref = doc(this.firestore, DOC_PATH);
    // Always write with merge:false so the doc fully reflects the form state.
    await setDoc(ref, { ...info, id: 'business' });
    this.refresh$.next();
  }

  /** Create the Firestore doc from the mock seed if it doesn't exist yet. */
  async seedIfMissing(): Promise<boolean> {
    const ref = doc(this.firestore, DOC_PATH);
    const snap = await getDoc(ref);
    if (snap.exists()) return false;
    await setDoc(ref, MOCK_BUSINESS_INFO);
    this.refresh$.next();
    return true;
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  private read(): Observable<BusinessInfo> {
    const ref = doc(this.firestore, DOC_PATH);
    return docData(ref).pipe(
      switchMap((data) => {
        if (data) return of(this.normalize(data as Partial<BusinessInfo>));
        // Doc missing — fall back to mock so the site still renders.
        return of(MOCK_BUSINESS_INFO);
      }),
      catchError((err) => {
        console.error('[BusinessInfoService] read failed', err);
        return of(MOCK_BUSINESS_INFO);
      })
    );
  }

  /** Ensure required collections exist even on partial / legacy docs. */
  private normalize(data: Partial<BusinessInfo>): BusinessInfo {
    return {
      ...MOCK_BUSINESS_INFO,
      ...data,
      businessHours: data.businessHours?.length
        ? data.businessHours
        : MOCK_BUSINESS_INFO.businessHours,
      holidays: data.holidays ?? [],
    };
  }
}
