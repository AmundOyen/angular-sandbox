import { computed, inject, Injectable, signal } from '@angular/core';
import { ImageLoader, LoadedImage } from './image-loader';
import {
  DEFAULT_RECT,
  fitToRatio,
  MaskMode,
  MaskRect,
  RATIO_PRESETS,
  RatioPreset,
  toPercentRatio,
} from './mask';

/**
 * Holds the image and its mask for the rest of the session, so they survive navigating
 * away from the page but not a reload.
 */
@Injectable({ providedIn: 'root' })
export class ImageMaskStore {
  private readonly loader = inject(ImageLoader);

  readonly image = signal<LoadedImage | null>(null);
  readonly rect = signal<MaskRect>(DEFAULT_RECT);
  readonly ratio = signal<RatioPreset>(RATIO_PRESETS[0]);
  readonly mode = signal<MaskMode>('crop');
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  /** The selected ratio expressed as percent width / percent height for the current image. */
  readonly percentRatio = computed(() => {
    const image = this.image();
    return image ? toPercentRatio(this.ratio().value, image.width / image.height) : null;
  });

  async open(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      this.error.set(`"${file.name}" is not an image.`);
      return;
    }
    this.loading.set(true);
    try {
      const image = await this.loader.load(file);
      this.release();
      this.image.set(image);
      this.rect.set(fitToRatio(DEFAULT_RECT, this.percentRatio()));
      this.error.set(null);
    } catch {
      this.error.set(`"${file.name}" could not be read as an image.`);
    } finally {
      this.loading.set(false);
    }
  }

  remove(): void {
    this.release();
    this.image.set(null);
    this.rect.set(DEFAULT_RECT);
    this.error.set(null);
  }

  setRatio(id: string): void {
    const preset = RATIO_PRESETS.find((p) => p.id === id);
    if (!preset) {
      return;
    }
    this.ratio.set(preset);
    this.rect.update((rect) => fitToRatio(rect, this.percentRatio()));
  }

  private release(): void {
    const image = this.image();
    if (image) {
      this.loader.release(image);
    }
  }
}
