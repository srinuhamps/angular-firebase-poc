import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  getDocs,
} from '@angular/fire/firestore';
import {
  Storage,
  ref,
  uploadBytes,
  getDownloadURL,
  getMetadata,
  deleteObject,
} from '@angular/fire/storage';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { MediaItem, MediaCategory } from '../models/media-item.model';

/** Legacy doc shape — some historical rows carry a single `category` string
 *  instead of the newer `categories` array. Handled at read time only. */
interface LegacyMediaDoc extends Partial<MediaItem> {
  category?: MediaCategory;
}

@Injectable({ providedIn: 'root' })
export class MediaService {
  private readonly firestore = inject(Firestore);
  // Inject AngularFire's Storage (bound to the FirebaseApp registered in
  // app.config.ts via provideStorage(...)). Use the ref / uploadBytes /
  // getDownloadURL / deleteObject helpers re-exported from
  // '@angular/fire/storage' — they know how to unwrap the AngularFire
  // proxy internally. Do NOT mix raw 'firebase/storage' calls with this
  // injected Storage instance: that path fails with
  // "Cannot read properties of undefined (reading 'path')".
  private readonly storage   = inject(Storage);

  /** Every stored item, newest first. Legacy single-category docs are
   *  normalized to `categories: [category]`; docs with neither field
   *  default to `['gallery']` so nothing disappears. */
  getAll(): Observable<MediaItem[]> {
    return from(
      getDocs(query(collection(this.firestore, 'media'), orderBy('createdAt', 'desc')))
    ).pipe(
      map((snapshot) =>
        snapshot.docs.map((d) => {
          const data = d.data() as LegacyMediaDoc;
          const categories: MediaCategory[] =
            Array.isArray(data.categories) && data.categories.length > 0
              ? data.categories
              : data.category
                ? [data.category]
                : ['gallery'];
          return {
            id:          d.id,
            title:       data.title       ?? '',
            url:         data.url         ?? '',
            storagePath: data.storagePath ?? '',
            createdAt:   data.createdAt   ?? 0,
            categories,
          } satisfies MediaItem;
        })
      )
    );
  }

  async upload(
    file: File,
    title: string,
    categories: MediaCategory[],
    onProgress: (pct: number) => void
  ): Promise<MediaItem> {
    if (categories.length === 0) {
      throw new Error('At least one category is required.');
    }
    const ext         = file.name.split('.').pop() ?? 'jpg';
    // Physical Storage folder is picked from the first (primary) category — it's
    // just an organisational nicety in the Firebase console; the `media/**` rule
    // already covers every nested subpath.
    const primary     = categories[0];
    const storagePath = `media/${primary}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
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
      categories,
    });
    onProgress(100);
    return { id: docRef.id, title, url, storagePath, createdAt, categories };
  }

  /** Retro-edit an existing item — used by the "Edit" pencil on each media
   *  card so admins can rename or re-file old uploads without re-uploading. */
  async updateItem(
    id: string,
    title: string,
    categories: MediaCategory[]
  ): Promise<void> {
    if (categories.length === 0) {
      throw new Error('At least one category is required.');
    }
    if (!title.trim()) {
      throw new Error('Title is required.');
    }
    await updateDoc(doc(this.firestore, 'media', id), {
      title: title.trim(),
      categories,
    });
  }

  /** Swap the image file in place — same Storage path, same public URL.
   *  The existing download token is carried over so every link that
   *  references the old URL keeps working. */
  async replaceImage(item: MediaItem, file: File): Promise<void> {
    const storageRef = ref(this.storage, item.storagePath);
    let tokens: string | undefined;
    try {
      tokens = (await getMetadata(storageRef)).customMetadata?.['firebaseStorageDownloadTokens'];
    } catch {
      // Missing metadata is fine; upload without preserving the token.
    }
    await uploadBytes(storageRef, file, tokens ? { customMetadata: { firebaseStorageDownloadTokens: tokens } } : undefined);
    // Touch the doc so any cached reader sees the change; URL is unchanged.
    await updateDoc(doc(this.firestore, 'media', item.id), { updatedAt: Date.now() });
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
