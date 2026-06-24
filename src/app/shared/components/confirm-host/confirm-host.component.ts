import { Component, HostListener, inject } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-confirm-host',
  standalone: true,
  imports: [],
  templateUrl: './confirm-host.component.html',
  styleUrl: './confirm-host.component.scss',
})
export class ConfirmHostComponent {
  readonly confirmSvc = inject(ConfirmService);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmSvc.pending()) this.confirmSvc.resolve(false);
  }
}
