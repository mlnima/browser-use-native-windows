import type { Observation } from '../types';
import { textResult } from '../util/json';

export const toolError = (error: unknown) => ({
  isError: true,
  ...textResult({ ok: false, error: error instanceof Error ? error.message : String(error) }),
});

export const observationResult = (observation: Observation) => {
  const { imageBase64, ...payload } = observation;
  const accessibilityNodes = payload.accessibilityNodes.map(({ globalBounds, globalCenter, ...node }) => node);
  const appBounds = payload.screenshot.globalBounds;
  const browserBounds = payload.browser.bounds;
  const monitorBounds = payload.screenshot.monitor?.bounds;
  const screenshot = {
    contentType: payload.screenshot.contentType,
    byteLength: payload.screenshot.byteLength,
    capturedAt: payload.screenshot.capturedAt,
    coordinateSpace: 'app-screenshot-pixels',
    width: payload.screenshot.width,
    height: payload.screenshot.height,
    contentBounds: payload.screenshot.contentBounds,
  };
  const publicPayload = {
    sessionId: payload.sessionId,
    observationToken: payload.observationToken,
    observedTargetType: payload.observedTargetType,
    currentUrl: payload.currentUrl,
    targetUrlStatus: payload.targetUrlStatus,
    screenshot,
    app: {
      coordinateSpace: 'physical-screen-pixels',
      x: appBounds.left,
      y: appBounds.top,
      width: appBounds.right - appBounds.left,
      height: appBounds.bottom - appBounds.top,
      dpi: payload.screenshot.dpi,
      scale: payload.screenshot.monitor?.scale || null,
    },
    browser: {
      coordinateSpace: 'physical-screen-pixels',
      x: browserBounds.left,
      y: browserBounds.top,
      width: browserBounds.right - browserBounds.left,
      height: browserBounds.bottom - browserBounds.top,
      monitor: payload.screenshot.monitor
        ? {
            id: payload.screenshot.monitor.id,
            width: monitorBounds!.right - monitorBounds!.left,
            height: monitorBounds!.bottom - monitorBounds!.top,
            dpi: payload.screenshot.monitor.dpi || null,
            scale: payload.screenshot.monitor.scale || null,
          }
        : null,
    },
    screenshotPath: payload.screenshotPath,
    accessibilityNodes,
    capturedAt: payload.capturedAt,
    consumed: payload.consumed,
    stale: payload.stale,
  };
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ ok: true, ...publicPayload }, null, 2),
      },
      ...(imageBase64
        ? [{
            type: 'image' as const,
            data: imageBase64,
            mimeType: observation.screenshot.contentType,
          }]
        : []),
    ],
  };
};
