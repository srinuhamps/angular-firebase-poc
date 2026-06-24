import { Component, OnInit, inject, computed } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { ToastHostComponent } from './shared/components/toast-host/toast-host.component';
import { ConfirmHostComponent } from './shared/components/confirm-host/confirm-host.component';
import { ScrollAnimationService } from './core/services/scroll-animation.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent, FooterComponent, ToastHostComponent, ConfirmHostComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private scrollAnimation = inject(ScrollAnimationService);
  private _theme = inject(ThemeService);
  private router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url)
    ),
    { initialValue: this.router.url }
  );

  readonly isAdminRoute = computed(() => this.url().startsWith('/admin'));

  ngOnInit(): void {
    this.scrollAnimation.init();
  }
}

