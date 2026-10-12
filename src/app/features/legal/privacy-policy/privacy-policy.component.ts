import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BusinessInfoService } from '../../../core/services/business-info.service';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  templateUrl: './privacy-policy.component.html',
  styleUrl: '../legal-page.scss',
})
export class PrivacyPolicyComponent {
  private readonly bizService = inject(BusinessInfoService);

  readonly info = toSignal(this.bizService.get(), { initialValue: null });

  readonly businessName = computed(() => this.info()?.name ?? 'Labelle Braid BB');
  readonly businessEmail = computed(() => this.info()?.email ?? 'info@labellebraidbb.com');
  readonly businessPhone = computed(() => this.info()?.phone ?? '');
  readonly effectiveDate = 'July 13, 2026';
}
