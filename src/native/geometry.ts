import type { Bounds, Point } from '../types';

export const boundsWidth = (bounds: Bounds) =>
  Math.max(0, bounds.right - bounds.left);

export const boundsHeight = (bounds: Bounds) =>
  Math.max(0, bounds.bottom - bounds.top);

export const boundsArea = (bounds: Bounds) =>
  boundsWidth(bounds) * boundsHeight(bounds);

export const intersectBounds = (a: Bounds, b: Bounds): Bounds | null => {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  return right > left && bottom > top ? { left, top, right, bottom } : null;
};

export const intersectBoundsArea = (a: Bounds, b: Bounds) =>
  boundsArea(intersectBounds(a, b) || { left: 0, top: 0, right: 0, bottom: 0 });

export const unionBounds = (bounds: Bounds[]) => {
  const first = bounds[0] || { left: 0, top: 0, right: 1, bottom: 1 };
  return bounds.reduce((current, entry) => ({
    left: Math.min(current.left, entry.left),
    top: Math.min(current.top, entry.top),
    right: Math.max(current.right, entry.right),
    bottom: Math.max(current.bottom, entry.bottom),
  }), first);
};

export const localToGlobalPoint = (bounds: Bounds, point: Point, size: { width: number; height: number }) => ({
  x: Math.round(bounds.left + point.x * (boundsWidth(bounds) / Math.max(1, size.width))),
  y: Math.round(bounds.top + point.y * (boundsHeight(bounds) / Math.max(1, size.height))),
});

export const pointInsideBounds = (point: Point, bounds: Bounds) =>
  point.x >= bounds.left &&
  point.y >= bounds.top &&
  point.x < bounds.right &&
  point.y < bounds.bottom;

export const contentBounds = (target: Bounds, client: Bounds): Bounds => ({
  left: client.left - target.left,
  top: client.top - target.top,
  right: client.right - target.left,
  bottom: client.bottom - target.top,
});
