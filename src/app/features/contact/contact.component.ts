import { Component, AfterViewInit, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SalonDataService } from '../../core/services/salon-data.service';
import { ScrollAnimationService } from '../../core/services/scroll-animation.service';
import { ContactMessagesService } from '../../core/services/contact-messages.service';
import { EmailService } from '../../core/services/email.service';
import { ToastService } from '../../core/services/toast.service';
import { BusinessInfo } from '../../core/models/business-info.model';
import { SectionTitleComponent } from '../../shared/components/section-title/section-title.component';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ReactiveFormsModule, SectionTitleComponent],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.scss',
})
export class ContactComponent implements AfterViewInit {
  private fb           = inject(FormBuilder);
  private dataService  = inject(SalonDataService);
  private scrollAnim   = inject(ScrollAnimationService);
  private sanitizer    = inject(DomSanitizer);
  private msgService   = inject(ContactMessagesService);
  private emailService = inject(EmailService);
  private toast        = inject(ToastService);

  /**
   * Live business profile. Signal-backed so the template refreshes when
   * Admin → Business Settings saves a change (this app runs zoneless, so
   * mutating a plain property inside a subscribe() would NOT re-render).
   */
  readonly businessInfo = signal<BusinessInfo | null>(null);
  readonly mapEmbedSafe = signal<SafeResourceUrl | null>(null);
  submitted = false;
  submitting = false;

  form: FormGroup = this.fb.group({
    name:    ['', [Validators.required, Validators.minLength(2)]],
    email:   ['', [Validators.required, Validators.email]],
    phone:   [''],
    subject: ['', Validators.required],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });

  constructor() {
    this.dataService.getBusinessInfo().subscribe((b) => {
      this.businessInfo.set(b);
      this.mapEmbedSafe.set(
        b?.mapEmbedUrl
          ? this.sanitizer.bypassSecurityTrustResourceUrl(
              this.toEmbedUrl(b.mapEmbedUrl)
            )
          : null
      );
    });
  }

  /** Accepts any Google Maps URL and returns a valid embed URL. */
  private toEmbedUrl(url: string): string {
    try {
      const u = new URL(url);
      // Short links (share.google, goo.gl) — resolve to the real Maps URL first
      if (u.hostname === 'share.google' || u.hostname === 'goo.gl') {
        // We can't follow redirects client-side, so use address-based search
        const biz = this.businessInfo();
        const q = [biz?.address, biz?.city, biz?.state, biz?.zip].filter(Boolean).join(', ');
        return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
      }
      // Already an embed URL
      if (u.pathname.includes('/maps/embed')) return url;
      // Share link with coordinates: /@lat,lng,zoom
      const coords = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coords) {
        return `https://www.google.com/maps?q=${coords[1]},${coords[2]}&z=15&output=embed`;
      }
      // Place page URL
      if (u.pathname.includes('/maps/place/')) {
        const place = u.pathname.split('/maps/place/')[1]?.split('/')[0] ?? '';
        return `https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed`;
      }
      // Fallback: use address-based search embed
      const q = u.searchParams.get('q') ?? url;
      return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
    } catch {
      // Not a valid URL — treat as raw address string
      return `https://www.google.com/maps?q=${encodeURIComponent(url)}&output=embed`;
    }
  }

  ngAfterViewInit(): void {
    this.scrollAnim.observeAll();
  }

  get f() { return this.form.controls; }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    const v = this.form.value;

    try {
      // Save to Firestore
      const id = await this.msgService.create({
        name:    v.name.trim(),
        email:   v.email.trim(),
        phone:   v.phone?.trim() || '',
        subject: v.subject.trim(),
        message: v.message.trim(),
      });

      this.toast.success('Message sent! We\'ll get back to you soon.', {
        title: 'Thank you'
      });

      // Send admin alert email with the full message object (fire and forget)
      const biz = this.businessInfo();
      if (biz?.email) {
        const fullMsg: any = {
          id,
          name:    v.name.trim(),
          email:   v.email.trim(),
          phone:   v.phone?.trim() || '',
          subject: v.subject.trim(),
          message: v.message.trim(),
          status:  'new',
          createdAt: new Date(),
          replies: [],
        };
        this.emailService.sendMessageAlert(fullMsg, biz.email).catch((err) => {
          console.error('[Contact] message alert email failed', err);
        });
      }

      this.submitted = true;
      this.form.reset();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.toast.error('Could not send message: ' + msg);
      console.error('[Contact] submit failed', err);
    } finally {
      this.submitting = false;
    }
  }
}
