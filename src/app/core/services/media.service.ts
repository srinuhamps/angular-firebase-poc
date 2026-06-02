import { Injectable, inject } from '@angular/core';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  getDocs,
} from '@angular/fire/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { MediaItem } from '../models/media-item.model';
import { environment } from '../../../environments/environment';

// Get or create a raw firebase app instance (separate from AngularFire DI
// which has version-mismatch incompatibility with Angular 21).
function getRawApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(environment.firebase);
}

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly firestore = inject(Firestore);
  // Use the RAW firebase SDK app (not AngularFire's DI token) for storage,
  // because @angular/fire 20 is incompatible with Angular 21 and the proxy
  // breaks raw firebase/storage calls with "Cannot read properties of undefined
  // (reading 'path')".
  private readonly storage   = getStorage(getRawApp());

  getAll(): Observable<MediaItem[]> {
    return from(
      getDocs(query(collection(this.firestore, 'media'), orderBy('createdAt', 'desc')))
    ).pipe(
      map((snapshot) =>
        snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as MediaItem))
      )
    );
  }

  async upload(
    file: File,
    title: string,
    onProgress: (pct: number) => void
  ): Promise<MediaItem> {
    const ext         = file.name.split('.').pop() ?? 'jpg';
    const storagePath = `media/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const storageRef  = ref(this.storage, storagePath);

    onProgress(10);
    await uploadBytes(storageRef, file);
    onProgress(80);

    const url       = await getDownloadURL(storageRef);
    const createdAt = Date.now();
    const docRef    = await addDoc(collection(this.firestore, 'media'), {
      title,
      url,
      storagePath,
      createdAt,
    });
    onProgress(100);
    return { id: docRef.id, title, url, storagePath, createdAt };
  }

  async delete(item: MediaItem): Promise<void> {
    try {
      await deleteObject(ref(this.storage, item.storagePath));
    } catch {
      // File may already be deleted; continue to remove Firestore doc
    }
    await deleteDoc(doc(this.firestore, 'media', item.id));
  }
}