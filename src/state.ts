import { randomUUID } from 'node:crypto';
import type { Observation, RunningBrowser, TransportMode } from './types';
import type { PointerVerification } from './native/input/actionTypes';

export type RuntimeState = {
  sessionId: string;
  transportMode: TransportMode;
  browser: RunningBrowser | null;
  browserWindow: { handle: string } | null;
  lastObservation: Observation | null;
  pointerVerification: PointerVerification | null;
  lastError: string | null;
};

export const createRuntimeState = (transportMode: TransportMode): RuntimeState => ({
  sessionId: randomUUID(),
  transportMode,
  browser: null,
  browserWindow: null,
  lastObservation: null,
  pointerVerification: null,
  lastError: null,
});

export const markObservationConsumed = (state: RuntimeState) => {
  if (!state.lastObservation) return;
  state.lastObservation.consumed = true;
  state.lastObservation.stale = true;
};

export const clearPointerVerification = (state: RuntimeState) => {
  state.pointerVerification = null;
};

export const setLastError = (state: RuntimeState, error: unknown) => {
  state.lastError = error instanceof Error ? error.message : String(error);
};
