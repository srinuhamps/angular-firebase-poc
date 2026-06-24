import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
})
export class AdminLayoutComponent {
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);

  readonly navItems = [
    { label: 'Dashboard', icon: '▤', route: '/admin/dashboard' },
    { label: 'Services',  icon: '✦', route: '/admin/services'  },
    { label: 'Products',  icon: '◈', route: '/admin/products'  },
    { label: 'Gallery',   icon: '🖼', route: '/admin/gallery'   },
    { label: 'Settings',  icon: '⚙', route: '/admin/settings'  },
  ];

  async logout(): Promise<void> {
    await this.authService.logout();
    this.router.navigate(['/admin/login']);
  }
}
