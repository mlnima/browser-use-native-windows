import type { Observation } from '../types';
import { textResult } from '../util/json';

export const toolError = (error: unknown) => ({
  isError: true,
  ...textResult({ ok: false, error: error instanceof Error ? error.message : String(error) }),
});

export const observationResult = (observation: Observation) => {
  const { imageBase64, ...payload } = observation;
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ ok: true, ...payload }, null, 2),
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
