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
  onSnapshot,
  Timestamp,
  arrayUnion,
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ContactMessage,
  ContactMessageReply,
  ContactMessageStatus,
} from '../models/contact-message.model';

/**
 * ContactMessagesService — Firestore-backed CRUD for `contactMessages/{id}`.
 *
 * The public contact form writes new messages with status='new'.
 * Admin reads/updates/replies/deletes are gated by Firestore rules + Auth.
 */
@Injectable({ providedIn: 'root' })
export class ContactMessagesService {
  private readonly firestore = inject(Firestore);
  private readonly colPath = 'contactMessages';

  /** All messages, newest first. */
  getAll(): Observable<ContactMessage[]> {
    return from(
      getDocs(query(collection(this.firestore, this.colPath), orderBy('createdAt', 'desc')))
    ).pipe(map((snap) => snap.docs.map((d) => this.fromDoc(d.id, d.data()))));
  }

  /**
   * Live stream of all contact messages (newest first). Use this in the admin
   * inbox so newly submitted messages appear without a refresh and the
   * dashboard counters stay in sync.
   */
  watchAll(): Observable<ContactMessage[]> {
    return new Observable<ContactMessage[]>((subscriber) => {
      const q = query(
        collection(this.firestore, this.colPath),
        orderBy('createdAt', 'desc')
      );
      const unsub = onSnapshot(
        q,
        (snap) => subscriber.next(snap.docs.map((d) => this.fromDoc(d.id, d.data()))),
        (err)  => subscriber.error(err)
      );
      return () => unsub();
    });
  }

  /**
   * Public-form submission.
   * Status / replies are normalized server-side defaults — clients can't override.
   */
  async create(input: {
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
  }): Promise<string> {
    const now = Timestamp.fromDate(new Date());
    const payload: Record<string, unknown> = {
      name:      input.name.trim(),
      email:     input.email.trim(),
      phone:     (input.phone ?? '').trim(),
      subject:   input.subject,
      message:   input.message.trim(),
      status:    'new' satisfies ContactMessageStatus,
      replies:   [],
      createdAt: now,
    };
    const ref = await addDoc(collection(this.firestore, this.colPath), payload);
    return ref.id;
  }

  async updateStatus(id: string, status: ContactMessageStatus): Promise<void> {
    await updateDoc(doc(this.firestore, this.colPath, id), {
      status,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  /**
   * Append a reply to a message and bump status to 'replied'.
   * The actual email delivery happens via EmailService — this only persists the record.
   */
  async appendReply(
    id: string,
    reply: Omit<ContactMessageReply, 'sentAt'> & { sentAt?: Date }
  ): Promise<void> {
    const sentAt = reply.sentAt ?? new Date();
    const stored: Record<string, unknown> = {
      body:   reply.body,
      sentAt: Timestamp.fromDate(sentAt),
    };
    if (reply.sentBy)                  stored['sentBy']                 = reply.sentBy;
    if (reply.emailProviderMessageId)  stored['emailProviderMessageId'] = reply.emailProviderMessageId;
    if (typeof reply.emailDelivered === 'boolean') {
      stored['emailDelivered'] = reply.emailDelivered;
    }

    await updateDoc(doc(this.firestore, this.colPath, id), {
      replies:   arrayUnion(stored),
      status:    'replied' satisfies ContactMessageStatus,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, this.colPath, id));
  }

  // ── Firestore <-> domain conversion ────────────────────────────────────────

  private fromDoc(id: string, data: Record<string, unknown>): ContactMessage {
    const createdAt =
      data['createdAt'] instanceof Timestamp
        ? (data['createdAt'] as Timestamp).toDate()
        : new Date(data['createdAt'] as string);
    const updatedAt =
      data['updatedAt'] instanceof Timestamp
        ? (data['updatedAt'] as Timestamp).toDate()
        : data['updatedAt']
        ? new Date(data['updatedAt'] as string)
        : undefined;

    const rawReplies = Array.isArray(data['replies']) ? (data['replies'] as unknown[]) : [];
    const replies: ContactMessageReply[] = rawReplies.map((r) => {
      const obj = r as Record<string, unknown>;
      const sentAt =
        obj['sentAt'] instanceof Timestamp
          ? (obj['sentAt'] as Timestamp).toDate()
          : new Date(obj['sentAt'] as string);
      return {
        body:                   (obj['body'] as string) ?? '',
        sentAt,
        sentBy:                 obj['sentBy']                 as string | undefined,
        emailProviderMessageId: obj['emailProviderMessageId'] as string | undefined,
        emailDelivered:         obj['emailDelivered']         as boolean | undefined,
      };
    });

    return {
      id,
      name:       (data['name']    as string) ?? '',
      email:      (data['email']   as string) ?? '',
      phone:      (data['phone']   as string) || undefined,
      subject:    (data['subject'] as string) ?? '',
      message:    (data['message'] as string) ?? '',
      status:     ((data['status'] as ContactMessageStatus) ?? 'new'),
      createdAt,
      updatedAt,
      replies,
      adminNotes: (data['adminNotes'] as string) || undefined,
    };
  }
}
