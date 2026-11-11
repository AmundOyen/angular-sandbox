import {
  clipPath,
  cropStyles,
  fitToRatio,
  hasOrientation,
  maskCss,
  MIN_SIZE,
  moveRect,
  orientRatio,
  rectFromPoints,
  resizeBy,
  resizeEdge,
  toPercentRatio,
  turnRect,
} from './mask';

describe('mask', () => {
  describe('toPercentRatio', () => {
    it('converts a pixel ratio to percent space for the image aspect', () => {
      // A square on a 2:1 image covers half as much of the width as of the height.
      expect(toPercentRatio(1, 2)).toBe(0.5);
      expect(toPercentRatio(null, 2)).toBeNull();
    });
  });

  describe('orientation', () => {
    it('only applies to ratios other than free-form and 1:1', () => {
      expect(hasOrientation(null)).toBe(false);
      expect(hasOrientation(1)).toBe(false);
      expect(hasOrientation(16 / 9)).toBe(true);
    });

    it('inverts the ratio for portrait', () => {
      expect(orientRatio(4 / 3, 'portrait')).toBe(3 / 4);
      expect(orientRatio(4 / 3, 'landscape')).toBe(4 / 3);
      expect(orientRatio(null, 'portrait')).toBeNull();
      expect(orientRatio(1, 'portrait')).toBe(1);
    });
  });

  describe('turnRect', () => {
    it('swaps the pixel width and height around the center', () => {
      // 40×20 % of an 800×400 image is 320×80 px; turned it is 80×320 px, or 10×80 %.
      expect(turnRect({ x: 30, y: 40, width: 40, height: 20 }, 2)).toEqual({
        x: 45,
        y: 10,
        width: 10,
        height: 80,
      });
    });

    it('scales down and stays inside the image', () => {
      // 800×100 px turns to 100×800 px, which only fits the 400 px height at half size.
      expect(turnRect({ x: 0, y: 0, width: 100, height: 25 }, 2)).toEqual({
        x: 46.875,
        y: 0,
        width: 6.25,
        height: 100,
      });
    });
  });

  describe('rectFromPoints', () => {
    it('spans the anchor and point in any direction', () => {
      expect(rectFromPoints({ x: 50, y: 50 }, { x: 20, y: 30 }, null)).toEqual({
        x: 20,
        y: 30,
        width: 30,
        height: 20,
      });
    });

    it('clamps the point to the image', () => {
      expect(rectFromPoints({ x: 50, y: 50 }, { x: 150, y: -10 }, null)).toEqual({
        x: 50,
        y: 0,
        width: 50,
        height: 50,
      });
    });

    it('keeps the ratio, following the dominant direction', () => {
      expect(rectFromPoints({ x: 10, y: 10 }, { x: 50, y: 20 }, 2)).toEqual({
        x: 10,
        y: 10,
        width: 40,
        height: 20,
      });
    });

    it('scales down to stay inside the image while keeping the ratio', () => {
      const rect = rectFromPoints({ x: 60, y: 10 }, { x: 100, y: 100 }, 1);
      expect(rect).toEqual({ x: 60, y: 10, width: 40, height: 40 });
    });
  });

  describe('moveRect', () => {
    it('stops at the image edges', () => {
      const rect = { x: 10, y: 10, width: 50, height: 50 };
      expect(moveRect(rect, -20, 80)).toEqual({ x: 0, y: 50, width: 50, height: 50 });
    });
  });

  describe('resizeEdge', () => {
    const rect = { x: 20, y: 20, width: 40, height: 40 };

    it('moves only the dragged edge', () => {
      expect(resizeEdge(rect, 'w', { x: 10, y: 0 })).toEqual({ ...rect, x: 10, width: 50 });
      expect(resizeEdge(rect, 's', { x: 0, y: 90 })).toEqual({ ...rect, height: 70 });
    });

    it('does not cross the opposite edge', () => {
      expect(resizeEdge(rect, 'e', { x: 0, y: 0 }).width).toBe(MIN_SIZE);
      expect(resizeEdge(rect, 'n', { x: 0, y: 99 })).toEqual({
        ...rect,
        y: 60 - MIN_SIZE,
        height: MIN_SIZE,
      });
    });
  });

  describe('resizeBy', () => {
    it('keeps the ratio and stays inside the image', () => {
      const rect = resizeBy({ x: 60, y: 0, width: 20, height: 10 }, 30, 0, 2);
      expect(rect).toEqual({ x: 60, y: 0, width: 40, height: 20 });
    });
  });

  describe('fitToRatio', () => {
    it('shrinks around the center', () => {
      expect(fitToRatio({ x: 0, y: 0, width: 100, height: 50 }, 1)).toEqual({
        x: 25,
        y: 0,
        width: 50,
        height: 50,
      });
    });

    it('leaves the rectangle alone without a ratio', () => {
      const rect = { x: 1, y: 2, width: 3, height: 4 };
      expect(fitToRatio(rect, null)).toBe(rect);
    });
  });

  describe('css', () => {
    const rect = { x: 10, y: 20, width: 50, height: 25 };

    it('builds a clip-path inset', () => {
      expect(clipPath(rect)).toBe('inset(20% 40% 55% 10%)');
    });

    it('builds crop styles that scale the area to the container', () => {
      expect(cropStyles(rect, 800, 400)).toEqual({
        aspectRatio: '400 / 100',
        width: '200%',
        left: '-20%',
        top: '-80%',
      });
    });

    it('generates copyable CSS for both modes', () => {
      expect(maskCss('clip', rect, 800, 400)).toContain('clip-path: inset(20% 40% 55% 10%);');
      const crop = maskCss('crop', rect, 800, 400);
      expect(crop).toContain('aspect-ratio: 400 / 100;');
      expect(crop).toContain('width: 200%;');
      expect(crop).not.toContain('border-radius');
    });

    it('builds an ellipse clip-path for a circle', () => {
      expect(clipPath(rect, 'circle')).toBe('ellipse(25% 12.5% at 35% 32.5%)');
    });

    it('generates round CSS for both modes', () => {
      expect(maskCss('clip', rect, 800, 400, 'circle')).toContain(
        'clip-path: ellipse(25% 12.5% at 35% 32.5%);',
      );
      expect(maskCss('crop', rect, 800, 400, 'circle')).toContain('border-radius: 50%;');
    });
  });
});
