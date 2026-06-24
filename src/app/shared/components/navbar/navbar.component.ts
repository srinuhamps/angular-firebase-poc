import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  inject,
  signal,
  computed,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeToggleComponent } from '../theme-toggle/theme-toggle.component';
import { AuthService } from '../../../core/services/auth.service';
import { BusinessInfoService } from '../../../core/services/business-info.service';
import {
  BusinessInfo,
  splitBrandName,
} from '../../../core/models/business-info.model';

interface NavLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ThemeToggleComponent],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent implements OnInit, OnDestroy {
  private platformId  = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private bizService  = inject(BusinessInfoService);

  readonly isAdmin = computed(() => this.authService.user() !== null);

  /** Live business info; drives the brand logo in the navbar. */
  readonly info = signal<BusinessInfo | null>(null);
  readonly brand = computed(() => splitBrandName(this.info()?.name));
  readonly fullName = computed(() => this.info()?.name ?? 'Labelle Braids BB');

  readonly navLinks: NavLink[] = [
    { label: 'Home',     path: '/'        },
    { label: 'Services', path: '/services' },
    { label: 'Products', path: '/products' },
    { label: 'About',    path: '/about'    },
    { label: 'Gallery',  path: '/gallery'  },
    { label: 'Contact',  path: '/contact'  },
  ];

  isScrolled  = signal(false);
  menuOpen    = signal(false);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.checkScroll();
    }
    this.bizService.info$.subscribe((b) => this.info.set(b));
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
  }

  @HostListener('window:scroll')
  checkScroll(): void {
    this.isScrolled.set(window.scrollY > 60);
  }

  toggleMenu(): void {
    const next = !this.menuOpen();
    this.menuOpen.set(next);
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = next ? 'hidden' : '';
    }
  }

  closeMenu(): void {
    this.menuOpen.set(false);
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
  }
}
