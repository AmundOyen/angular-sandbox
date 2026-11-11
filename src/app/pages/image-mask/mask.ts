/** A rectangle in percent of the image's width and height (0–100). */
export interface MaskRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export type MaskMode = 'crop' | 'clip';

/** The outline of the visible area. An oval and a circle fill the selected rectangle. */
export type MaskShape = 'rect' | 'oval' | 'circle';

export interface ShapeOption {
  id: MaskShape;
  label: string;
  icon: string;
}

export const SHAPE_OPTIONS: ShapeOption[] = [
  { id: 'rect', label: 'Rectangle', icon: 'crop_square' },
  { id: 'oval', label: 'Oval', icon: 'egg' },
  { id: 'circle', label: 'Circle', icon: 'circle' },
];

/** Smallest width or height a rectangle can have, in percent. */
export const MIN_SIZE = 1;

export const DEFAULT_RECT: MaskRect = { x: 10, y: 10, width: 80, height: 80 };

export interface RatioPreset {
  id: string;
  label: string;
  /** Width / height in pixels, or null for free-form. */
  value: number | null;
}

export const RATIO_PRESETS: RatioPreset[] = [
  { id: 'free', label: 'Free', value: null },
  { id: '1:1', label: '1:1', value: 1 },
  { id: '4:3', label: '4:3', value: 4 / 3 },
  { id: '3:4', label: '3:4', value: 3 / 4 },
  { id: '16:9', label: '16:9', value: 16 / 9 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Rounds to two decimals and drops trailing zeros, for readable CSS. */
function fmt(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

/**
 * Converts a pixel aspect ratio to the equivalent ratio of percent width to percent height
 * for an image with the given aspect ratio (width / height).
 */
export function toPercentRatio(pixelRatio: number | null, imageAspect: number): number | null {
  return pixelRatio === null ? null : pixelRatio / imageAspect;
}

/**
 * Builds the rectangle spanned by a fixed anchor and a moving point, kept inside the image.
 * With a ratio, the side the pointer has moved furthest along wins and the other follows.
 */
export function rectFromPoints(anchor: Point, point: Point, ratio: number | null): MaskRect {
  const x = clamp(point.x, 0, 100);
  const y = clamp(point.y, 0, 100);
  const right = x >= anchor.x;
  const down = y >= anchor.y;
  let width = Math.abs(x - anchor.x);
  let height = Math.abs(y - anchor.y);

  if (ratio !== null && width > 0 && height > 0) {
    if (width / height > ratio) {
      height = width / ratio;
    } else {
      width = height * ratio;
    }
    const maxWidth = right ? 100 - anchor.x : anchor.x;
    const maxHeight = down ? 100 - anchor.y : anchor.y;
    const scale = Math.min(1, maxWidth / width, maxHeight / height);
    width *= scale;
    height *= scale;
  }

  return {
    x: right ? anchor.x : anchor.x - width,
    y: down ? anchor.y : anchor.y - height,
    width,
    height,
  };
}

/** Moves a rectangle by a delta, keeping it inside the image. */
export function moveRect(rect: MaskRect, dx: number, dy: number): MaskRect {
  return {
    ...rect,
    x: clamp(rect.x + dx, 0, 100 - rect.width),
    y: clamp(rect.y + dy, 0, 100 - rect.height),
  };
}

/** Moves one edge of a rectangle to a point, keeping the opposite edge fixed. */
export function resizeEdge(rect: MaskRect, edge: 'n' | 'e' | 's' | 'w', point: Point): MaskRect {
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  switch (edge) {
    case 'e':
      return { ...rect, width: clamp(point.x - rect.x, MIN_SIZE, 100 - rect.x) };
    case 's':
      return { ...rect, height: clamp(point.y - rect.y, MIN_SIZE, 100 - rect.y) };
    case 'w': {
      const x = clamp(point.x, 0, right - MIN_SIZE);
      return { ...rect, x, width: right - x };
    }
    case 'n': {
      const y = clamp(point.y, 0, bottom - MIN_SIZE);
      return { ...rect, y, height: bottom - y };
    }
  }
}

/** Grows or shrinks a rectangle from its top-left corner, keeping it inside the image. */
export function resizeBy(rect: MaskRect, dw: number, dh: number, ratio: number | null): MaskRect {
  if (ratio !== null) {
    if (dw !== 0) {
      dh = dw / ratio;
    } else {
      dw = dh * ratio;
    }
  }
  let width = clamp(rect.width + dw, MIN_SIZE, 100 - rect.x);
  let height = clamp(rect.height + dh, MIN_SIZE, 100 - rect.y);
  if (ratio !== null) {
    if (width / height > ratio) {
      width = height * ratio;
    } else {
      height = width / ratio;
    }
  }
  return { ...rect, width, height };
}

/** Shrinks a rectangle around its center to match a ratio. */
export function fitToRatio(rect: MaskRect, ratio: number | null): MaskRect {
  if (ratio === null) {
    return rect;
  }
  let { width, height } = rect;
  if (width / height > ratio) {
    width = height * ratio;
  } else {
    height = width / ratio;
  }
  return {
    x: rect.x + (rect.width - width) / 2,
    y: rect.y + (rect.height - height) / 2,
    width,
    height,
  };
}

/**
 * `clip-path` value that hides everything outside the area, leaving the image in place.
 * A circle is drawn as an ellipse because its radii are a pixel square, not a percent square.
 */
export function clipPath(rect: MaskRect, shape: MaskShape = 'rect'): string {
  if (shape !== 'rect') {
    const rx = fmt(rect.width / 2);
    const ry = fmt(rect.height / 2);
    const cx = fmt(rect.x + rect.width / 2);
    const cy = fmt(rect.y + rect.height / 2);
    return `ellipse(${rx}% ${ry}% at ${cx}% ${cy}%)`;
  }
  const top = fmt(rect.y);
  const right = fmt(100 - rect.x - rect.width);
  const bottom = fmt(100 - rect.y - rect.height);
  const left = fmt(rect.x);
  return `inset(${top}% ${right}% ${bottom}% ${left}%)`;
}

export interface CropStyles {
  /** For the container: the selected area's pixel aspect ratio. */
  aspectRatio: string;
  /** For the image inside the container. */
  width: string;
  left: string;
  top: string;
}

/**
 * Styles that scale the selected area to fill an `overflow: hidden` container. The image is
 * sized relative to the container width and offset so the area's top-left corner is at 0,0.
 */
export function cropStyles(rect: MaskRect, imageWidth: number, imageHeight: number): CropStyles {
  return {
    aspectRatio: `${fmt((rect.width * imageWidth) / 100)} / ${fmt((rect.height * imageHeight) / 100)}`,
    width: `${fmt((100 / rect.width) * 100)}%`,
    left: `${fmt((-rect.x / rect.width) * 100)}%`,
    top: `${fmt((-rect.y / rect.height) * 100)}%`,
  };
}

/** The CSS a developer can copy to apply the mask. */
export function maskCss(
  mode: MaskMode,
  rect: MaskRect,
  imageWidth: number,
  imageHeight: number,
  shape: MaskShape = 'rect',
): string {
  if (mode === 'clip') {
    return `.masked-image {\n  clip-path: ${clipPath(rect, shape)};\n}\n`;
  }
  const crop = cropStyles(rect, imageWidth, imageHeight);
  return [
    '.masked-image {',
    '  position: relative;',
    '  overflow: hidden;',
    `  aspect-ratio: ${crop.aspectRatio};`,
    ...(shape === 'rect' ? [] : ['  border-radius: 50%;']),
    '}',
    '',
    '.masked-image img {',
    '  position: absolute;',
    '  max-width: none;',
    `  width: ${crop.width};`,
    `  left: ${crop.left};`,
    `  top: ${crop.top};`,
    '}',
    '',
  ].join('\n');
}
