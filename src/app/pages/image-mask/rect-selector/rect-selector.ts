import { Component, computed, ElementRef, input, model, viewChild } from '@angular/core';
import { MaskRect, MIN_SIZE, moveRect, Point, rectFromPoints, resizeBy, resizeEdge } from '../mask';

type Corner = 'nw' | 'ne' | 'se' | 'sw';
type Edge = 'n' | 'e' | 's' | 'w';
type Handle = Corner | Edge;

const CORNERS: Corner[] = ['nw', 'ne', 'se', 'sw'];
const ALL_HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

type Drag =
  | { kind: 'draw'; anchor: Point; start: MaskRect }
  | { kind: 'move'; origin: Point; start: MaskRect }
  | { kind: 'corner'; anchor: Point }
  | { kind: 'edge'; edge: Edge };

/** Keyboard step in percent of the image. */
const STEP = 1;

/**
 * Shows an image with a rectangle the user can draw, move and resize to mark the visible area.
 * Drag on the image to draw a new rectangle, drag inside it to move it, or drag a handle to
 * resize it. When focused, arrow keys move the rectangle and Shift+arrow keys resize it.
 */
@Component({
  selector: 'app-rect-selector',
  templateUrl: './rect-selector.html',
  styleUrl: './rect-selector.scss',
})
export class RectSelector {
  readonly src = input.required<string>();
  readonly alt = input('');
  /** Width / height of the rectangle in percent space, or null for free-form. */
  readonly ratio = input<number | null>(null);
  /** Shows the visible area as an ellipse filling the rectangle. */
  readonly round = input(false);
  readonly rect = model.required<MaskRect>();

  protected readonly box = computed(() => {
    const { x, y, width, height } = this.rect();
    return { left: `${x}%`, top: `${y}%`, width: `${width}%`, height: `${height}%` };
  });

  /** Edge handles can't keep a ratio on their own, so only corners are shown with one. */
  protected readonly handles = computed(() => (this.ratio() === null ? ALL_HANDLES : CORNERS));

  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private drag: Drag | null = null;

  protected startDraw(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    const anchor = this.toPoint(event);
    this.begin(event, { kind: 'draw', anchor, start: this.rect() });
    this.rect.set(rectFromPoints(anchor, anchor, this.ratio()));
  }

  protected startMove(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    this.begin(event, { kind: 'move', origin: this.toPoint(event), start: this.rect() });
  }

  protected startResize(event: PointerEvent, handle: Handle): void {
    if (event.button !== 0) {
      return;
    }
    event.stopPropagation();
    const { x, y, width, height } = this.rect();
    if (handle.length === 2) {
      // The opposite corner stays put.
      const anchor = {
        x: handle.includes('w') ? x + width : x,
        y: handle.includes('n') ? y + height : y,
      };
      this.begin(event, { kind: 'corner', anchor });
    } else {
      this.begin(event, { kind: 'edge', edge: handle as Edge });
    }
  }

  protected onPointerMove(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag) {
      return;
    }
    const point = this.toPoint(event);
    switch (drag.kind) {
      case 'draw':
        this.rect.set(rectFromPoints(drag.anchor, point, this.ratio()));
        break;
      case 'move':
        this.rect.set(moveRect(drag.start, point.x - drag.origin.x, point.y - drag.origin.y));
        break;
      case 'corner':
        this.rect.set(this.atLeastMinSize(rectFromPoints(drag.anchor, point, this.ratio())));
        break;
      case 'edge':
        this.rect.set(resizeEdge(this.rect(), drag.edge, point));
        break;
    }
  }

  protected onPointerUp(): void {
    const drag = this.drag;
    this.drag = null;
    // A click without a drag shouldn't wipe out the current selection.
    if (drag?.kind === 'draw') {
      const { width, height } = this.rect();
      if (width < MIN_SIZE || height < MIN_SIZE) {
        this.rect.set(drag.start);
      }
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-STEP, 0],
      ArrowRight: [STEP, 0],
      ArrowUp: [0, -STEP],
      ArrowDown: [0, STEP],
    };
    const step = delta[event.key];
    if (!step) {
      return;
    }
    event.preventDefault();
    const [dx, dy] = step;
    this.rect.set(
      event.shiftKey ? resizeBy(this.rect(), dx, dy, this.ratio()) : moveRect(this.rect(), dx, dy),
    );
  }

  private begin(event: PointerEvent, drag: Drag): void {
    this.drag = drag;
    (event.target as Element).setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }

  private toPoint(event: PointerEvent): Point {
    const box = this.stage().nativeElement.getBoundingClientRect();
    return {
      x: box.width ? ((event.clientX - box.left) / box.width) * 100 : 0,
      y: box.height ? ((event.clientY - box.top) / box.height) * 100 : 0,
    };
  }

  /** Dragging a corner onto its anchor would collapse the rectangle; keep the last usable one. */
  private atLeastMinSize(rect: MaskRect): MaskRect {
    return rect.width < MIN_SIZE || rect.height < MIN_SIZE ? this.rect() : rect;
  }
}
