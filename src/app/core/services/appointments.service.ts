import { Injectable, inject } from '@angular/core';
import {
  Firestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  Timestamp,
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Appointment, AppointmentStatus } from '../models/appointment.model';

/**
 * AppointmentsService — Firestore-backed CRUD for `appointments/{id}`.
 *
 * Time conventions:
 *  - `Appointment.date` is stored as midnight (local time) of the booking day.
 *  - `startTime` / `endTime` are display strings like '10:00 AM'.
 *  - Slot conflict logic operates in "minutes since midnight".
 */
@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly firestore = inject(Firestore);
  private readonly colPath = 'appointments';

  /** All appointments, newest first. Used by the admin list. */
  getAll(): Observable<Appointment[]> {
    return from(
      getDocs(query(collection(this.firestore, this.colPath), orderBy('date', 'desc')))
    ).pipe(map((snap) => snap.docs.map((d) => this.fromDoc(d.id, d.data()))));
  }

  /**
   * Live stream of all appointments (newest first). Emits every time the
   * collection changes in Firestore — ideal for the admin dashboard so
   * new bookings appear without a refresh.
   *
   * The returned Observable unsubscribes the Firestore listener when the
   * consumer unsubscribes (use `takeUntilDestroyed` in components).
   */
  watchAll(): Observable<Appointment[]> {
    return new Observable<Appointment[]>((subscriber) => {
      const q = query(
        collection(this.firestore, this.colPath),
        orderBy('date', 'desc')
      );
      const unsub = onSnapshot(
        q,
        (snap) => subscriber.next(snap.docs.map((d) => this.fromDoc(d.id, d.data()))),
        (err)  => subscriber.error(err)
      );
      return () => unsub();
    });
  }

  /** Appointments for a specific calendar day (used for slot conflict checks). */
  getForDate(date: Date): Observable<Appointment[]> {
    const dayStart = startOfDay(date);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const q = query(
      collection(this.firestore, this.colPath),
      where('date', '>=', Timestamp.fromDate(dayStart)),
      where('date', '<', Timestamp.fromDate(dayEnd))
    );
    return from(getDocs(q)).pipe(
      map((snap) => snap.docs.map((d) => this.fromDoc(d.id, d.data())))
    );
  }

  /** Create a new appointment. Returns the Firestore-generated id. */
  async create(appt: Omit<Appointment, 'id'>): Promise<string> {
    const ref = await addDoc(collection(this.firestore, this.colPath), this.toDoc(appt));
    return ref.id;
  }

  async updateStatus(id: string, status: AppointmentStatus): Promise<void> {
    await updateDoc(doc(this.firestore, this.colPath, id), {
      status,
      updatedAt: Timestamp.fromDate(new Date()),
    });
  }

  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, this.colPath, id));
  }

  // ── Firestore <-> domain conversion ────────────────────────────────────────

  private fromDoc(id: string, data: Record<string, unknown>): Appointment {
    const date = data['date'] instanceof Timestamp ? (data['date'] as Timestamp).toDate() : new Date(data['date'] as string);
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
    return { ...(data as object), id, date, createdAt, updatedAt } as Appointment;
  }

  private toDoc(appt: Omit<Appointment, 'id'>): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      ...appt,
      date: Timestamp.fromDate(appt.date),
      createdAt: Timestamp.fromDate(appt.createdAt),
      updatedAt: appt.updatedAt ? Timestamp.fromDate(appt.updatedAt) : null,
    };
    // Firestore rejects undefined values - strip them out
    for (const key of Object.keys(doc)) {
      if (doc[key] === undefined) {
        delete doc[key];
      }
    }
    return doc;
  }
}

// ── Time helpers (exported for component reuse) ──────────────────────────────

/** '9:00 AM' / '10:30 PM' / '09:00' (24-h HH:MM from <input type="time">) → minutes since midnight. Returns -1 if invalid. */
export function parseDisplayTime(t: string | undefined | null): number {
  if (!t) return -1;
  // Format 1: "9:00 AM" / "10:30 PM" (12-hour with AM/PM)
  const m12 = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let h = Number(m12[1]);
    const mins = Number(m12[2]);
    const mer = m12[3].toUpperCase();
    if (h === 12) h = 0;
    if (mer === 'PM') h += 12;
    return h * 60 + mins;
  }
  // Format 2: "HH:MM" — exactly two-digit hour (24-hour from <input type="time">)
  const m24 = t.trim().match(/^(\d{2}):(\d{2})$/);
  if (m24) {
    const h = Number(m24[1]);
    const mins = Number(m24[2]);
    if (h > 23 || mins > 59) return -1;
    return h * 60 + mins;
  }
  return -1;
}

/** minutes since midnight → '10:30 AM'. */
export function formatDisplayTime(totalMinutes: number): string {
  const h24 = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  const mer = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${mer}`;
}

/** Local-time midnight of the given date. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** ISO 'YYYY-MM-DD' for a Date in local time. */
export function toIsoDateString(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}
