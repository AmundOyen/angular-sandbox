import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MaskRect } from '../mask';
import { RectSelector } from './rect-selector';

@Component({
  imports: [RectSelector],
  template: `<app-rect-selector src="data:," [ratio]="ratio()" [(rect)]="rect" />`,
})
class Host {
  readonly rect = signal<MaskRect>({ x: 10, y: 10, width: 40, height: 40 });
  readonly ratio = signal<number | null>(null);
}

describe('RectSelector', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let element: HTMLElement;

  /** Dispatches a pointer event at a position in percent of the 200×100 px stage. */
  function pointer(target: Element, type: string, x: number, y: number): void {
    target.dispatchEvent(
      new MouseEvent(type, { bubbles: true, button: 0, clientX: x * 2, clientY: y }),
    );
  }

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    await fixture.whenStable();
    const stage = element.querySelector('.stage') as HTMLElement;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
  });

  const stage = () => element.querySelector('.stage') as HTMLElement;
  const selection = () => element.querySelector('.selection') as HTMLElement;
  const handle = (name: string) => element.querySelector(`[data-handle="${name}"]`) as HTMLElement;

  it('positions the selection from the rect', () => {
    expect(selection().style.left).toBe('10%');
    expect(selection().style.width).toBe('40%');
  });

  it('draws a new rectangle when dragging on the image', () => {
    pointer(stage(), 'pointerdown', 60, 20);
    pointer(stage(), 'pointermove', 90, 70);
    pointer(stage(), 'pointerup', 90, 70);
    expect(host.rect()).toEqual({ x: 60, y: 20, width: 30, height: 50 });
  });

  it('keeps the previous rectangle when the image is only clicked', () => {
    pointer(stage(), 'pointerdown', 80, 80);
    pointer(stage(), 'pointerup', 80, 80);
    expect(host.rect()).toEqual({ x: 10, y: 10, width: 40, height: 40 });
  });

  it('moves the rectangle when dragging inside it', () => {
    pointer(selection(), 'pointerdown', 20, 20);
    pointer(selection(), 'pointermove', 30, 25);
    pointer(selection(), 'pointerup', 30, 25);
    expect(host.rect()).toEqual({ x: 20, y: 15, width: 40, height: 40 });
  });

  it('resizes from a corner, keeping the opposite corner fixed', () => {
    pointer(handle('nw'), 'pointerdown', 10, 10);
    pointer(handle('nw'), 'pointermove', 0, 30);
    pointer(handle('nw'), 'pointerup', 0, 30);
    expect(host.rect()).toEqual({ x: 0, y: 30, width: 50, height: 20 });
  });

  it('only offers corner handles when a ratio is set', async () => {
    expect(element.querySelectorAll('.handle').length).toBe(8);
    host.ratio.set(1);
    await fixture.whenStable();
    expect(element.querySelectorAll('.handle').length).toBe(4);
  });

  it('moves with arrow keys and resizes with Shift+arrow keys', () => {
    selection().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(host.rect()).toEqual({ x: 11, y: 10, width: 40, height: 40 });
    selection().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', shiftKey: true }));
    expect(host.rect()).toEqual({ x: 11, y: 10, width: 40, height: 41 });
  });
});
