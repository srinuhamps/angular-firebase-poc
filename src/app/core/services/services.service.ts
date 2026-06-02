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
import { HairService } from '../models/hair-service.model';
import { MOCK_SERVICES } from '../../data/mock/services.mock';

@Injectable({ providedIn: 'root' })
export class ServicesService {
  private readonly firestore = inject(Firestore);

  getAll(): Observable<HairService[]> {
    return from(
      getDocs(query(collection(this.firestore, 'services'), orderBy('sortOrder')))
    ).pipe(
      map((snapshot) =>
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as HairService))
      )
    );
  }

  async add(service: Omit<HairService, 'id'>): Promise<void> {
    await addDoc(collection(this.firestore, 'services'), service);
  }

  async update(id: string, changes: Partial<HairService>): Promise<void> {
    await updateDoc(doc(this.firestore, 'services', id), changes);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'services', id));
  }

  async seedIfEmpty(): Promise<void> {
    const col = collection(this.firestore, 'services');
    const snapshot = await getDocs(col);
    if (!snapshot.empty) return;
    const batch = writeBatch(this.firestore);
    MOCK_SERVICES.forEach((svc) => {
      batch.set(doc(col, svc.id), svc);
    });
    await batch.commit();
  }
}
