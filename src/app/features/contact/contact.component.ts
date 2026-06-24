import { Component, AfterViewInit, inject } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators, FormGroup } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SalonDataService } from '../../core/services/salon-data.service';
import { ScrollAnimationService } from '../../core/services/scroll-animation.service';
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
  private fb          = inject(FormBuilder);
  private dataService = inject(SalonDataService);
  private scrollAnim  = inject(ScrollAnimationService);
  private sanitizer   = inject(DomSanitizer);

  businessInfo: BusinessInfo | null = null;
  mapEmbedSafe: SafeResourceUrl | null = null;
  submitted = false;

  form: FormGroup = this.fb.group({
    name:    ['', [Validators.required, Validators.minLength(2)]],
    email:   ['', [Validators.required, Validators.email]],
    phone:   [''],
    subject: ['', Validators.required],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });

  constructor() {
    this.dataService.getBusinessInfo().subscribe((b) => {
      this.businessInfo = b;
      this.mapEmbedSafe = b.mapEmbedUrl
        ? this.sanitizer.bypassSecurityTrustResourceUrl(b.mapEmbedUrl)
        : null;
    });
  }

  ngAfterViewInit(): void {
    this.scrollAnim.observeAll();
  }

  get f() { return this.form.controls; }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    // Phase 3: Replace with Firestore write or email service
    console.log('Contact form submitted:', this.form.value);
    this.submitted = true;
    this.form.reset();
  }
}
