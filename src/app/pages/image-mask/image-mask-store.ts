import { computed, inject, Injectable, signal } from '@angular/core';
import { ImageLoader, LoadedImage } from './image-loader';
import {
  DEFAULT_RECT,
  fitToRatio,
  hasOrientation,
  MaskMode,
  MaskRect,
  MaskShape,
  Orientation,
  orientRatio,
  RATIO_PRESETS,
  RatioPreset,
  toPercentRatio,
  turnRect,
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
  readonly shape = signal<MaskShape>('rect');
  readonly orientation = signal<Orientation>('landscape');
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  /** Free-form and 1:1 look the same either way round, so only other ratios can be turned. */
  readonly orientable = computed(() => hasOrientation(this.ratio().value));

  /** The ratio in effect, expressed as percent width / percent height for the current image. */
  readonly percentRatio = computed(() => {
    const image = this.image();
    const value = orientRatio(this.ratio().value, this.orientation());
    return image ? toPercentRatio(value, image.width / image.height) : null;
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

  setShape(shape: MaskShape): void {
    this.shape.set(shape);
  }

  setOrientation(orientation: Orientation): void {
    const image = this.image();
    if (orientation === this.orientation()) {
      return;
    }
    this.orientation.set(orientation);
    if (image) {
      // Turn the current area rather than refit it, so flipping back and forth doesn't shrink it.
      const turned = turnRect(this.rect(), image.width / image.height);
      this.rect.set(fitToRatio(turned, this.percentRatio()));
    }
  }

  private release(): void {
    const image = this.image();
    if (image) {
      this.loader.release(image);
    }
  }
}
