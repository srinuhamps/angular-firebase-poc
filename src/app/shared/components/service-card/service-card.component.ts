import { Component, ElementRef, Input, ViewChild, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HairService } from '../../../core/models/hair-service.model';

@Component({
  selector: 'app-service-card',
  standalone: true,
  imports: [RouterLink, TitleCasePipe],
  templateUrl: './service-card.component.html',
  styleUrl: './service-card.component.scss',
})
export class ServiceCardComponent {
  @Input({ required: true }) service!: HairService;

  @ViewChild('detailsDialog') detailsDialogRef?: ElementRef<HTMLDialogElement>;

  readonly detailsOpen = signal(false);
  readonly selectedImageIndex = signal(0);

  get imageUrls(): string[] {
    return [...new Set([
      this.service.imageUrl,
      ...(this.service.mediaUrls ?? []),
    ].filter(Boolean))];
  }

  get primaryImage(): string {
    return this.imageUrls[this.selectedImageIndex()] ?? '';
  }

  selectImage(index: number): void {
    this.selectedImageIndex.set(index);
  }

  handleStackImageClick(index: number): void {
    if (this.selectedImageIndex() === index) {
      this.nextImage();
      return;
    }
    this.selectImage(index);
  }

  previousImage(): void {
    const count = this.imageUrls.length;
    if (count > 1) this.selectImage((this.selectedImageIndex() - 1 + count) % count);
  }

  nextImage(): void {
    const count = this.imageUrls.length;
    if (count > 1) this.selectImage((this.selectedImageIndex() + 1) % count);
  }

  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  openDetails(): void {
    const dlg = this.detailsDialogRef?.nativeElement;
    if (!dlg) return;
    this.detailsOpen.set(true);
    dlg.showModal();
    document.body.style.overflow = 'hidden';
  }

  closeDetails(): void {
    this.detailsDialogRef?.nativeElement.close();
  }

  onDialogClose(): void {
    this.detailsOpen.set(false);
    document.body.style.overflow = '';
  }

  onDialogClick(event: MouseEvent): void {
    // Native <dialog> reports clicks on the backdrop with target === the dialog itself.
    if (event.target === this.detailsDialogRef?.nativeElement) {
      this.closeDetails();
    }
  }
}
