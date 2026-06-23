import path from 'node:path';

export const packageName = 'browser-use-native-windows';
export const defaultSseHost = '127.0.0.1';
export const defaultSsePort = 7331;
export const defaultSseAuth = 'change.me';
export const defaultForceStopHotkey = 'Control+F12';
export const screenshotMaxSide = 2000;
export const screenshotMaxBytes = 5 * 1024 * 1024;
export const accessibilityMaxNodes = 120;
export const scrollDefault = -720;
export const scrollMin = -5000;
export const scrollMax = 5000;
export const mouseTargetAttempts = 8;
export const mouseStepDelta = 6;
export const mouseSpeedMultiplier = 3;
export const browserWindowFindAttempts = 12;
export const browserWindowFindDelayMs = 150;
export const foregroundWaitAttempts = 10;
export const foregroundWaitDelayMs = 120;
export const clickDelayMs = 80;
export const doubleClickDelayMs = 75;
export const actionAfterNavigationWaitMs = 1200;

export const runtimeDir = () =>
  path.join(process.cwd(), '.browser-use-native-windows');

export const screenshotDir = () =>
  path.join(runtimeDir(), 'screenshots');

export const defaultUserDataDir = () =>
  path.join(runtimeDir(), 'user-data');
