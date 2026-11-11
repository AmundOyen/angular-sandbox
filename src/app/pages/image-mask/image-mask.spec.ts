import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ImageLoader, LoadedImage } from './image-loader';
import { ImageMask } from './image-mask';
import { ImageMaskStore } from './image-mask-store';

class FakeImageLoader {
  readonly released: LoadedImage[] = [];

  load(file: File): Promise<LoadedImage> {
    return Promise.resolve({ url: `blob:${file.name}`, name: file.name, width: 800, height: 400 });
  }

  release(image: LoadedImage): void {
    this.released.push(image);
  }
}

describe('ImageMask', () => {
  let fixture: ComponentFixture<ImageMask>;
  let element: HTMLElement;
  let loader: FakeImageLoader;
  let store: ImageMaskStore;

  async function selectFile(file: File): Promise<void> {
    const input = element.querySelector('[data-testid="file-input"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  const png = (name = 'photo.png') => new File([''], name, { type: 'image/png' });

  beforeEach(async () => {
    loader = new FakeImageLoader();
    await TestBed.configureTestingModule({
      imports: [ImageMask],
      providers: [{ provide: ImageLoader, useValue: loader }],
    }).compileComponents();

    fixture = TestBed.createComponent(ImageMask);
    element = fixture.nativeElement;
    store = TestBed.inject(ImageMaskStore);
    await fixture.whenStable();
  });

  it('asks for an image when there is none', () => {
    expect(element.querySelector('.drop-zone')).toBeTruthy();
    expect(element.querySelector('app-rect-selector')).toBeNull();
  });

  it('shows the editor, preview and CSS after choosing an image', async () => {
    await selectFile(png());

    expect(element.querySelector('.file-name')?.textContent).toContain('photo.png');
    expect(element.querySelector('app-rect-selector')).toBeTruthy();
    const crop = element.querySelector('.masked-crop') as HTMLElement;
    expect(crop.style.getPropertyValue('--crop-aspect')).toBe('640 / 320');
    expect(element.querySelector('.css')?.textContent).toContain('aspect-ratio: 640 / 320;');
  });

  it('switches the preview and CSS to clip in place', async () => {
    await selectFile(png());
    store.mode.set('clip');
    await fixture.whenStable();

    const image = element.querySelector('.masked-clip') as HTMLImageElement;
    expect(image.style.clipPath).toBe('inset(10% 10% 10% 10%)');
    expect(element.querySelector('.css')?.textContent).toContain(
      'clip-path: inset(10% 10% 10% 10%);',
    );
  });

  it('fits the rectangle to a ratio preset in image pixels', async () => {
    await selectFile(png());
    store.setRatio('1:1');
    await fixture.whenStable();

    // 1:1 in pixels on an 800×400 image is half as wide as tall in percent.
    expect(store.rect()).toEqual({ x: 30, y: 10, width: 40, height: 80 });
    expect(element.querySelector('.readout')?.textContent).toContain('320 × 320 px');
  });

  it('clips to an ellipse that fills the selection', async () => {
    await selectFile(png());
    store.setShape('circle');
    store.mode.set('clip');
    await fixture.whenStable();

    // The shape doesn't change the selection; with Free it is an oval.
    expect(store.rect()).toEqual({ x: 10, y: 10, width: 80, height: 80 });
    const image = element.querySelector('.masked-clip') as HTMLImageElement;
    expect(image.style.clipPath).toBe('ellipse(40% 40% at 50% 50%)');
    expect(element.querySelector('app-rect-selector .selection.round')).toBeTruthy();
  });

  it('makes a true circle with a 1:1 ratio', async () => {
    await selectFile(png());
    store.setShape('circle');
    store.setRatio('1:1');
    await fixture.whenStable();

    expect(element.querySelector('.readout')?.textContent).toContain('320 × 320 px');
    expect(element.querySelector('.masked-crop.round')).toBeTruthy();
    expect(element.querySelector('.css')?.textContent).toContain('border-radius: 50%;');
  });

  it('offers portrait and landscape only for ratios that have them', async () => {
    const orientationToggle = () => element.querySelector('[aria-label="Orientation"]');
    await selectFile(png());
    expect(orientationToggle()).toBeNull();

    store.setRatio('1:1');
    await fixture.whenStable();
    expect(orientationToggle()).toBeNull();

    store.setRatio('4:3');
    await fixture.whenStable();
    expect(orientationToggle()).toBeTruthy();
    expect(element.querySelector('.readout')?.textContent).toContain('320 × 240 px');

    store.setOrientation('portrait');
    await fixture.whenStable();
    expect(element.querySelector('.readout')?.textContent).toContain('240 × 320 px');

    // Flipping back turns the area again instead of shrinking it.
    store.setOrientation('landscape');
    await fixture.whenStable();
    expect(element.querySelector('.readout')?.textContent).toContain('320 × 240 px');

    // 3:2 for a classic photo look fits inside the current area.
    store.setRatio('3:2');
    await fixture.whenStable();
    expect(element.querySelector('.readout')?.textContent).toContain('320 × 213 px');
  });

  it('rejects files that are not images', async () => {
    await selectFile(new File(['hi'], 'notes.txt', { type: 'text/plain' }));

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      '"notes.txt" is not an image.',
    );
    expect(element.querySelector('.drop-zone')).toBeTruthy();
  });

  it('releases the old image when replacing or removing it', async () => {
    await selectFile(png('first.png'));
    await selectFile(png('second.png'));
    expect(loader.released.map((image) => image.name)).toEqual(['first.png']);

    Array.from(element.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Remove'))!
      .click();
    await fixture.whenStable();

    expect(loader.released.map((image) => image.name)).toEqual(['first.png', 'second.png']);
    expect(element.querySelector('.drop-zone')).toBeTruthy();
  });
});
