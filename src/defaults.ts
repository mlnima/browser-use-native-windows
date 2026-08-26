import os from 'node:os';
import path from 'node:path';

export const packageName = 'browser-use-native-windows';
export const defaultSseHost = '0.0.0.0';
export const defaultSsePort = 7331;
export const defaultSseAuth = 'change.me';
export const defaultForceStopHotkey = 'Control+F12';
export const screenshotMaxSide = 1600;
export const screenshotMaxBytes = 5 * 1024 * 1024;
export const accessibilityMaxNodes = 80;
export const accessibilityReadTimeoutMs = 3000;
export const scrollDefault = -720;
export const scrollMin = -5000;
export const scrollMax = 5000;
export const browserWindowFindAttempts = 32;
export const browserWindowFindDelayMs = 250;
export const observationSnapshotAttempts = 2;
export const foregroundWaitAttempts = 10;
export const foregroundWaitDelayMs = 120;
export const clickDelayMs = 80;
export const doubleClickDelayMs = 75;
export const actionSettleDelayMs = 150;
export const defaultPageLoadTimeoutMs = 10000;
export const pageLoadPollIntervalMs = 250;
export const pageLoadDetectionWindowMs = 750;
export const pageLoadMinimumWaitMs = 750;
export const pageLoadStableSampleCount = 3;
export const pageLoadSampleWidth = 128;
export const pageLoadSampleHeight = 72;
export const pageLoadSampleTopRatio = 0.18;
export const pageLoadPixelDelta = 8;
export const pageLoadStablePixelRatio = 0.002;
export const pageLoadChangedPixelRatio = 0.05;
export const pageLoadMinimumVariance = 0.02;

export const runtimeDir = () =>
  path.join(os.homedir(), '.browser-use-native-windows');

export const screenshotDir = () =>
  path.join(runtimeDir(), 'screenshots');

export const logDir = () =>
  path.join(runtimeDir(), 'logs');

export const defaultUserDataDir = () =>
  path.join(runtimeDir(), 'user-data');
