import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  getDocs,
  writeBatch,
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Stylist } from '../models/stylist.model';
import { MOCK_STYLISTS } from '../../data/mock/stylists.mock';

@Injectable({ providedIn: 'root' })
export class StylistsService {
  private readonly firestore = inject(Firestore);

  getAll(): Observable<Stylist[]> {
    return from(
      getDocs(query(collection(this.firestore, 'stylists'), orderBy('name')))
    ).pipe(
      map((snapshot) =>
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Stylist))
      )
    );
  }

  async add(stylist: Omit<Stylist, 'id'>): Promise<void> {
    await addDoc(collection(this.firestore, 'stylists'), stylist);
  }

  async update(id: string, changes: Partial<Stylist>): Promise<void> {
    await updateDoc(doc(this.firestore, 'stylists', id), changes);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'stylists', id));
  }

  async seedIfEmpty(): Promise<void> {
    const col = collection(this.firestore, 'stylists');
    const snapshot = await getDocs(col);
    if (!snapshot.empty) return;
    const batch = writeBatch(this.firestore);
    MOCK_STYLISTS.forEach((sty) => {
      batch.set(doc(col, sty.id), sty);
    });
    await batch.commit();
  }

  /**
   * Additive seed — writes any mock stylist whose id is not already present.
   * Safe to run repeatedly; existing docs are never modified.
   * Returns the number of stylists that were newly added.
   */
  async seedMissing(): Promise<number> {
    const col = collection(this.firestore, 'stylists');
    const snapshot = await getDocs(col);
    const existingIds = new Set(snapshot.docs.map((d) => d.id));
    const missing = MOCK_STYLISTS.filter((s) => !existingIds.has(s.id));
    if (missing.length === 0) return 0;
    const batch = writeBatch(this.firestore);
    missing.forEach((sty) => batch.set(doc(col, sty.id), sty));
    await batch.commit();
    return missing.length;
  }
}
