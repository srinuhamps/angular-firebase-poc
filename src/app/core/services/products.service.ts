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
import { Product } from '../models/product.model';
import { MOCK_PRODUCTS } from '../../data/mock/products.mock';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly firestore = inject(Firestore);

  getAll(): Observable<Product[]> {
    return from(
      getDocs(query(collection(this.firestore, 'products'), orderBy('sortOrder')))
    ).pipe(
      map((snapshot) =>
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Product))
      )
    );
  }

  async add(product: Omit<Product, 'id'>): Promise<void> {
    await addDoc(collection(this.firestore, 'products'), product);
  }

  async update(id: string, changes: Partial<Product>): Promise<void> {
    await updateDoc(doc(this.firestore, 'products', id), changes);
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, 'products', id));
  }

  async seedIfEmpty(): Promise<void> {
    const col = collection(this.firestore, 'products');
    const snapshot = await getDocs(col);
    if (!snapshot.empty) return;
    const batch = writeBatch(this.firestore);
    MOCK_PRODUCTS.forEach((prd) => {
      batch.set(doc(col, prd.id), prd);
    });
    await batch.commit();
  }
}
