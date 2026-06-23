import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { screenshotDir, screenshotMaxBytes, screenshotMaxSide } from '../defaults';
import type { Bounds, MonitorInfo, ObservedTargetType, ScreenshotMetadata, WindowInfo } from '../types';
import { boundsHeight, boundsWidth, contentBounds, intersectBounds, intersectBoundsArea, unionBounds } from './geometry';
import { captureWindowImage, listDisplays } from './windowsWindow';

type NormalizedImage = {
  buffer: Buffer;
  contentType: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
};

const qualitySteps = [90, 82, 74, 66, 58, 50, 42, 34];

const sideGrid = (maxSide: number, start: number) => {
  const values = new Set<number>();
  for (const factor of [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
    values.add(Math.max(1, Math.round(Math.min(maxSide, start) * factor)));
  }
  return Array.from(values).sort((a, b) => b - a);
};

const normalizeImage = async (buffer: Buffer): Promise<NormalizedImage> => {
  const metadata = await sharp(buffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const maxDim = Math.max(width, height);
  if (buffer.byteLength <= screenshotMaxBytes && (maxDim === 0 || (width <= screenshotMaxSide && height <= screenshotMaxSide))) {
    return { buffer, contentType: 'image/png', width: Math.max(1, width), height: Math.max(1, height) };
  }
  let smallest: Buffer | null = null;
  for (const side of sideGrid(screenshotMaxSide, maxDim || screenshotMaxSide)) {
    for (const quality of qualitySteps) {
      const out = await sharp(buffer).resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true }).jpeg({ quality }).toBuffer();
      smallest = !smallest || out.byteLength < smallest.byteLength ? out : smallest;
      if (out.byteLength <= screenshotMaxBytes) {
        const meta = await sharp(out).metadata();
        return { buffer: out, contentType: 'image/jpeg', width: Number(meta.width || 1), height: Number(meta.height || 1) };
      }
    }
  }
  const size = ((smallest?.byteLength || buffer.byteLength) / (1024 * 1024)).toFixed(2);
  throw new Error(`Browser screenshot could not be reduced below ${(screenshotMaxBytes / (1024 * 1024)).toFixed(0)}MB (got ${size}MB)`);
};

const monitorRows = (displays: MonitorInfo[], target: Bounds) =>
  displays.map((display, index) => ({
    ...display,
    index,
    intersectionArea: intersectBoundsArea(target, display.bounds),
  }));

const selectedMonitor = (monitors: ReturnType<typeof monitorRows>) =>
  monitors.reduce((selected, entry) => entry.intersectionArea > selected.intersectionArea ? entry : selected, monitors[0] || null);

const visibleBounds = (target: Bounds, displays: MonitorInfo[]) => {
  const intersections = displays.map((display) => intersectBounds(target, display.bounds)).filter((entry): entry is Bounds => !!entry);
  return intersections.length > 0 ? unionBounds(intersections) : target;
};

const saveScreenshot = async (buffer: Buffer, contentType: string) => {
  fs.mkdirSync(screenshotDir(), { recursive: true });
  const extension = contentType === 'image/jpeg' ? 'jpg' : 'png';
  const file = path.join(screenshotDir(), `browser-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`);
  fs.writeFileSync(file, buffer);
  return file;
};

export const captureObservedScreenshot = async (params: {
  browser: WindowInfo;
  target: WindowInfo;
  targetType: ObservedTargetType;
}) => {
  const displays = await listDisplays();
  const targetBounds = visibleBounds(params.target.bounds, displays);
  const browserBounds = visibleBounds(params.browser.bounds, displays);
  const raw = Buffer.from(await captureWindowImage(targetBounds), 'base64');
  const normalized = await normalizeImage(raw);
  const screenshotPath = await saveScreenshot(normalized.buffer, normalized.contentType);
  const monitors = monitorRows(displays, targetBounds);
  const monitor = selectedMonitor(monitors);
  const metadata: ScreenshotMetadata = {
    contentType: normalized.contentType,
    byteLength: normalized.buffer.byteLength,
    capturedAt: new Date().toISOString(),
    coordinateSpace: params.targetType,
    globalCoordinateSpace: 'screen',
    origin: { x: targetBounds.left, y: targetBounds.top },
    globalBounds: targetBounds,
    browserBounds,
    browserClientBounds: params.targetType === 'browser-window' ? params.browser.clientBounds : undefined,
    fileDialogBounds: params.targetType === 'file-dialog' ? targetBounds : undefined,
    contentBounds: params.targetType === 'browser-window' ? contentBounds(params.browser.bounds, params.browser.clientBounds) : undefined,
    virtualBounds: displays.length > 0 ? unionBounds(displays.map((display) => display.bounds)) : targetBounds,
    width: normalized.width || boundsWidth(targetBounds),
    height: normalized.height || boundsHeight(targetBounds),
    monitorIndex: monitor?.index ?? 0,
    monitor: monitor || null,
    dpi: params.target.dpi || params.target.monitor?.dpi || params.browser.dpi || null,
    monitors,
  };
  return { metadata, screenshotPath, imageBase64: normalized.buffer.toString('base64') };
};
