import fs from 'node:fs';
import sharp from 'sharp';
import {
  pageLoadChangedPixelRatio,
  pageLoadDetectionWindowMs,
  pageLoadMinimumVariance,
  pageLoadMinimumWaitMs,
  pageLoadPixelDelta,
  pageLoadPollIntervalMs,
  pageLoadSampleHeight,
  pageLoadSampleTopRatio,
  pageLoadSampleWidth,
  pageLoadStablePixelRatio,
  pageLoadStableSampleCount,
} from '../defaults';
import type { WindowInfo } from '../types';
import { sleep } from '../util/time';
import { boundsHeight, boundsWidth } from './geometry';
import { readCurrentBrowserUrl, urlsMatch } from './urlReader';
import { captureWindowImage } from './windowsWindow';

export type PageVisual = {
  pixels: Buffer;
  variance: number;
};

const visualFromBuffer = async (buffer: Buffer): Promise<PageVisual> => {
  const metadata = await sharp(buffer).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (width < 1 || height < 1) throw new Error('Browser page readiness image is empty.');
  const top = Math.min(height - 1, Math.round(height * pageLoadSampleTopRatio));
  const pixels = await sharp(buffer)
    .extract({ left: 0, top, width, height: height - top })
    .resize({ width: pageLoadSampleWidth, height: pageLoadSampleHeight, fit: 'fill' })
    .greyscale()
    .raw()
    .toBuffer();
  const mean = pixels.reduce((sum, value) => sum + value, 0) / pixels.length;
  const variance = Math.sqrt(
    pixels.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / pixels.length,
  ) / 255;
  return { pixels, variance };
};

const differenceRatio = (left: PageVisual, right: PageVisual) => {
  if (left.pixels.length !== right.pixels.length) return 1;
  let changed = 0;
  for (let index = 0; index < left.pixels.length; index += 1) {
    if (Math.abs(left.pixels[index]! - right.pixels[index]!) >= pageLoadPixelDelta) changed += 1;
  }
  return changed / left.pixels.length;
};

export const capturePageVisual = async (window: WindowInfo) =>
  await visualFromBuffer(Buffer.from(await captureWindowImage({
    handle: window.handle,
    width: boundsWidth(window.clientBounds),
    height: boundsHeight(window.clientBounds),
  }), 'base64'));

export const readPageVisual = async (screenshotPath: string) =>
  await visualFromBuffer(await fs.promises.readFile(screenshotPath));

export const waitForPageLoad = async (params: {
  window: WindowInfo;
  baseline: PageVisual | null;
  previousUrl: string | null;
  startedAt: number;
  timeoutMs: number;
  required: boolean;
}) => {
  const deadline = params.startedAt + params.timeoutMs;
  let previous = params.baseline;
  let currentUrl = await readCurrentBrowserUrl(params.window);
  let loadDetected = params.required;
  let visualChanged = !params.baseline;
  let stableSamples = 0;
  while (Date.now() <= deadline) {
    const sample = await capturePageVisual(params.window);
    currentUrl = await readCurrentBrowserUrl(params.window) || currentUrl;
    const changedFromBaseline = params.baseline
      ? differenceRatio(params.baseline, sample) >= pageLoadChangedPixelRatio
      : true;
    const urlChanged = !!params.previousUrl && !!currentUrl && !urlsMatch(currentUrl, params.previousUrl);
    visualChanged ||= changedFromBaseline;
    loadDetected ||= urlChanged || changedFromBaseline;
    stableSamples = previous && differenceRatio(previous, sample) <= pageLoadStablePixelRatio
      ? stableSamples + 1
      : 0;
    const elapsed = Date.now() - params.startedAt;
    const visuallyReady = visualChanged && sample.variance >= pageLoadMinimumVariance &&
      stableSamples >= pageLoadStableSampleCount && elapsed >= pageLoadMinimumWaitMs;
    if (loadDetected && visuallyReady) return currentUrl;
    if (!params.required && !loadDetected && elapsed >= pageLoadDetectionWindowMs) return currentUrl;
    previous = sample;
    await sleep(Math.min(pageLoadPollIntervalMs, Math.max(1, deadline - Date.now())));
  }
  return currentUrl;
};
