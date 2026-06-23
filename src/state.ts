import { randomUUID } from 'node:crypto';
import type { Observation, RunningBrowser, TransportMode, WindowInfo } from './types';

export type RuntimeState = {
  sessionId: string;
  transportMode: TransportMode;
  browser: RunningBrowser | null;
  browserWindow: WindowInfo | null;
  lastObservation: Observation | null;
  lastError: string | null;
};

export const createRuntimeState = (transportMode: TransportMode): RuntimeState => ({
  sessionId: randomUUID(),
  transportMode,
  browser: null,
  browserWindow: null,
  lastObservation: null,
  lastError: null,
});

export const markObservationConsumed = (state: RuntimeState) => {
  if (!state.lastObservation) return;
  state.lastObservation.consumed = true;
  state.lastObservation.stale = true;
};

export const setLastError = (state: RuntimeState, error: unknown) => {
  state.lastError = error instanceof Error ? error.message : String(error);
};
