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
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { ServiceAddon } from '../models/service-addon.model';

/**
 * CRUD for the `serviceAddons` collection. Mirrors `ServicesService` so admin
 * pages can be built with the same patterns.
 */
@Injectable({ providedIn: 'root' })
export class ServiceAddonsService {
  private readonly firestore = inject(Firestore);

  getAll(): Observable<ServiceAddon[]> {
    return from(
      getDocs(query(collection(this.firestore, 'serviceAddons'), orderBy('sortOrder')))
    ).pipe(
      map((snapshot) => snapshot.docs.map((d) => this.toAddon(d.id, d.data())))
    );
  }

  /** Imported documents predate some fields, so fill in defaults rather than trusting the shape. */
  private toAddon(id: string, data: Record<string, unknown>): ServiceAddon {
    return {
      id,
      name: typeof data['name'] === 'string' ? data['name'] : '',
      priceDelta: typeof data['priceDelta'] === 'number' ? data['priceDelta'] : 0,
      durationDelta: typeof data['durationDelta'] === 'number' ? data['durationDelta'] : 0,
      appliesToAll: data['appliesToAll'] === true,
      appliesToServiceIds: Array.isArray(data['appliesToServiceIds'])
        ? (data['appliesToServiceIds'] as unknown[]).filter((v): v is string => typeof v === 'string')
        : [],
      isActive: data['isActive'] !== false,
      sortOrder: typeof data['sortOrder'] === 'number' ? data['sortOrder'] : 0,
    };
  }

  async add(addon: Omit<ServiceAddon, 'id'>): Promise<void> {
    await addDoc(collection(this.firestore, 'serviceAddons'), addon);
  }

  async update(id: string, changes: Partial<ServiceAddon>): Promise<void> {
    await updateDoc(doc(this.firestore, 'serviceAddons', id), changes);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'serviceAddons', id));
  }
}
