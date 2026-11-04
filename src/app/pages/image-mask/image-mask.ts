import { CdkCopyToClipboard } from '@angular/cdk/clipboard';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ImageMaskStore } from './image-mask-store';
import { clipPath, cropStyles, maskCss, MaskMode, RATIO_PRESETS } from './mask';
import { RectSelector } from './rect-selector/rect-selector';

@Component({
  imports: [
    CdkCopyToClipboard,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressBarModule,
    RectSelector,
  ],
  selector: 'app-image-mask',
  styleUrl: './image-mask.scss',
  templateUrl: './image-mask.html',
})
export class ImageMask {
  protected readonly store = inject(ImageMaskStore);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly ratioPresets = RATIO_PRESETS;
  protected readonly dragOver = signal(false);

  protected readonly clipPath = computed(() => clipPath(this.store.rect()));

  protected readonly crop = computed(() => {
    const image = this.store.image();
    return image ? cropStyles(this.store.rect(), image.width, image.height) : null;
  });

  protected readonly css = computed(() => {
    const image = this.store.image();
    return image ? maskCss(this.store.mode(), this.store.rect(), image.width, image.height) : '';
  });

  /** The selection in image pixels, for the readout under the editor. */
  protected readonly pixels = computed(() => {
    const image = this.store.image();
    const rect = this.store.rect();
    if (!image) {
      return null;
    }
    return {
      x: Math.round((rect.x * image.width) / 100),
      y: Math.round((rect.y * image.height) / 100),
      width: Math.round((rect.width * image.width) / 100),
      height: Math.round((rect.height * image.height) / 100),
    };
  });

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so choosing the same file again still fires a change event.
    input.value = '';
    if (file) {
      void this.store.open(file);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) {
      void this.store.open(file);
    }
  }

  protected setMode(mode: MaskMode): void {
    this.store.mode.set(mode);
  }

  protected onCopied(copied: boolean): void {
    this.snackBar.open(copied ? 'CSS copied to clipboard' : 'Could not copy the CSS', undefined, {
      duration: 2500,
    });
  }
}
