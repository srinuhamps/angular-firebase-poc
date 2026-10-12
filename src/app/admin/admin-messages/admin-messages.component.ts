import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContactMessagesService } from '../../core/services/contact-messages.service';
import { EmailService } from '../../core/services/email.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { BusinessInfoService } from '../../core/services/business-info.service';
import {
  ContactMessage,
  ContactMessageStatus,
  CONTACT_SUBJECT_LABELS,
} from '../../core/models/contact-message.model';

type StatusFilter = ContactMessageStatus | 'all' | 'open';

@Component({
  selector: 'app-admin-messages',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-messages.component.html',
  styleUrl: './admin-messages.component.scss',
})
export class AdminMessagesComponent {
  private readonly messagesService = inject(ContactMessagesService);
  private readonly emailService    = inject(EmailService);
  private readonly authService     = inject(AuthService);
  private readonly confirmSvc      = inject(ConfirmService);
  private readonly toast           = inject(ToastService);
  private readonly bizService      = inject(BusinessInfoService);

  /** Latest business name; appended to outgoing reply subjects. */
  private readonly businessName    = signal<string>('Labelle Braid BB');

  readonly messages    = signal<ContactMessage[]>([]);
  readonly loading     = signal<boolean>(true);
  readonly selectedId  = signal<string | null>(null);
  readonly statusFilter= signal<StatusFilter>('open');
  readonly busy        = signal<boolean>(false);
  readonly replyDraft  = signal<string>('');
  readonly replyNotice = signal<string>('');
  readonly replyError  = signal<string>('');

  readonly filters: { label: string; value: StatusFilter }[] = [
    { label: 'Open',     value: 'open'     },
    { label: 'New',      value: 'new'      },
    { label: 'Read',     value: 'read'     },
    { label: 'Replied',  value: 'replied'  },
    { label: 'Archived', value: 'archived' },
    { label: 'All',      value: 'all'      },
  ];

  readonly filtered = computed<ContactMessage[]>(() => {
    const f = this.statusFilter();
    const all = this.messages();
    if (f === 'all')  return all;
    if (f === 'open') return all.filter((m) => m.status === 'new' || m.status === 'read');
    return all.filter((m) => m.status === f);
  });

  readonly selected = computed<ContactMessage | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.messages().find((m) => m.id === id) ?? null;
  });

  readonly newCount = computed<number>(
    () => this.messages().filter((m) => m.status === 'new').length
  );

  constructor() {
    this.bizService.info$.subscribe((b) => {
      const name = (b?.name ?? '').trim();
      if (name) this.businessName.set(name);
    });
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    let knownIds: Set<string> | null = null;
    this.messagesService.watchAll().subscribe({
      next: (list) => {
        if (knownIds === null) {
          knownIds = new Set(list.map((m) => m.id));
        } else {
          for (const m of list) {
            if (!knownIds.has(m.id) && m.status === 'new') {
              this.toast.info(
                `${m.name} sent a new message.`,
                { title: 'New contact message' }
              );
            }
            knownIds.add(m.id);
          }
        }
        this.messages.set(list);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('[AdminMessages] live stream failed', err);
        this.loading.set(false);
      },
    });
  }

  subjectLabel(code: string): string {
    return CONTACT_SUBJECT_LABELS[code] ?? code;
  }

  formatWhen(d: Date): string {
    return d.toLocaleString('en-US', {
      month:  'short',
      day:    'numeric',
      year:   'numeric',
      hour:   'numeric',
      minute: '2-digit',
    });
  }

  async select(msg: ContactMessage): Promise<void> {
    this.selectedId.set(msg.id);
    this.replyDraft.set('');
    this.replyNotice.set('');
    this.replyError.set('');
    // Auto-mark as read when an admin opens a 'new' message.
    if (msg.status === 'new') {
      await this.markStatus(msg, 'read', /* silent */ true);
    }
  }

  closeDetail(): void {
    this.selectedId.set(null);
  }

  async markStatus(
    msg: ContactMessage,
    status: ContactMessageStatus,
    silent = false
  ): Promise<void> {
    if (!silent) this.busy.set(true);
    try {
      await this.messagesService.updateStatus(msg.id, status);
      this.messages.update((list) =>
        list.map((m) => (m.id === msg.id ? { ...m, status, updatedAt: new Date() } : m))
      );
    } catch (err) {
      console.error('[AdminMessages] status update failed', err);
    } finally {
      if (!silent) this.busy.set(false);
    }
  }

  async deleteMessage(msg: ContactMessage): Promise<void> {
    const ok = await this.confirmSvc.ask({
      title:       'Delete message?',
      message:     `The message from ${msg.name} (${msg.email}) will be permanently removed, along with any replies. This cannot be undone.`,
      confirmText: 'Delete',
      danger:      true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await this.messagesService.delete(msg.id);
      this.messages.update((list) => list.filter((m) => m.id !== msg.id));
      if (this.selectedId() === msg.id) this.selectedId.set(null);
      this.toast.success(`Deleted message from ${msg.name}.`);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      this.toast.error('Could not delete message: ' + m);
    } finally {
      this.busy.set(false);
    }
  }

  async sendReply(): Promise<void> {
    const msg = this.selected();
    const body = this.replyDraft().trim();
    if (!msg || !body || this.busy()) return;

    this.busy.set(true);
    this.replyError.set('');
    this.replyNotice.set('');

    const sentBy = this.authService.user()?.email ?? undefined;
    const replySubject = `Re: ${this.subjectLabel(msg.subject)} — ${this.businessName()}`;

    // Dispatch the reply via Brevo (through the sendEmail Cloud Function).
    const emailResult = await this.emailService.send({
      to:       msg.email,
      toName:   msg.name,
      subject:  replySubject,
      bodyText: body,
      replyTo:  sentBy,
    });

    // Always persist the reply record so admins keep a log even if email
    // delivery isn't configured yet.
    try {
      await this.messagesService.appendReply(msg.id, {
        body,
        sentBy,
        emailProviderMessageId: emailResult.providerMessageId,
        emailDelivered:         emailResult.delivered,
      });

      this.messages.update((list) =>
        list.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                status: 'replied',
                updatedAt: new Date(),
                replies: [
                  ...m.replies,
                  {
                    body,
                    sentAt: new Date(),
                    sentBy,
                    emailProviderMessageId: emailResult.providerMessageId,
                    emailDelivered:         emailResult.delivered,
                  },
                ],
              }
            : m
        )
      );

      this.replyDraft.set('');
      this.replyNotice.set(
        emailResult.delivered
          ? 'Reply sent and logged.'
          : 'Reply logged. (Email delivery not yet configured — connect Brevo to actually send.)'
      );
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      this.replyError.set('Could not save reply: ' + m);
    } finally {
      this.busy.set(false);
    }
  }
}
