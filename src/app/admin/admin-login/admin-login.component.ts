import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { BusinessInfoService } from '../../core/services/business-info.service';
import {
  BusinessInfo,
  splitBrandName,
} from '../../core/models/business-info.model';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
})
export class AdminLoginComponent {
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);
  private readonly bizService  = inject(BusinessInfoService);

  /** Live business info for the brand badge on the login card. */
  private readonly info  = signal<BusinessInfo | null>(null);
  readonly brand         = computed(() => splitBrandName(this.info()?.name));
  readonly subLabel      = computed(() => {
    const sub = this.brand().sub;
    return sub ? `${sub} · Admin` : 'Admin';
  });

  email    = '';
  password = '';
  error    = signal<string>('');
  loading  = signal<boolean>(false);

  constructor() {
    this.bizService.info$.subscribe((b) => this.info.set(b));
  }

  async onSubmit(): Promise<void> {
    if (!this.email || !this.password) return;
    this.error.set('');
    this.loading.set(true);
    try {
      await this.authService.login(this.email, this.password);
      this.router.navigate(['/admin/dashboard']);
    } catch {
      this.error.set('Invalid email or password. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
