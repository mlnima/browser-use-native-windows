import type { Observation } from '../types';
import { textResult } from '../util/json';

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

export const toolError = (error: unknown) => ({
  isError: true,
  ...textResult({ ok: false, error: errorText(error) }),
});

const publicObservation = (observation: Observation) => ({
  sessionId: observation.sessionId,
  observationToken: observation.observationToken,
  observedTargetType: observation.observedTargetType,
  currentUrl: observation.currentUrl,
  targetUrlStatus: observation.targetUrlStatus,
  screenshot: {
    contentType: observation.screenshot.contentType,
    byteLength: observation.screenshot.byteLength,
    capturedAt: observation.screenshot.capturedAt,
    coordinateSpace: 'app-screenshot-pixels',
    width: observation.screenshot.width,
    height: observation.screenshot.height,
    contentBounds: observation.screenshot.contentBounds,
    cursor: {
      visible: observation.screenshot.cursor.visible,
      position: observation.screenshot.cursor.position,
    },
  },
  accessibilityNodes: observation.accessibilityNodes.map((node) => ({
    id: node.id,
    role: node.role,
    name: node.name,
    bounds: node.bounds,
    center: node.center,
    ...(node.checked === null ? {} : { checked: node.checked }),
  })),
  capturedAt: observation.capturedAt,
  consumed: observation.consumed,
  stale: observation.stale,
});

export const observationResult = (observation: Observation, details: Record<string, unknown> = {}) => ({
  content: [
    {
      type: 'text' as const,
      text: JSON.stringify({ ok: details.ok !== false, ...details, ...publicObservation(observation) }),
    },
    ...(observation.imageBase64
      ? [{
          type: 'image' as const,
          data: observation.imageBase64,
          mimeType: observation.screenshot.contentType,
        }]
      : []),
  ],
});

export const observationErrorResult = (
  error: unknown,
  observation: Observation,
  details: Record<string, unknown> = {},
) => ({
  isError: true,
  ...observationResult(observation, { ...details, ok: false, error: errorText(error) }),
});
