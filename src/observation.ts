import { randomUUID } from 'node:crypto';
import type { ServerConfig } from './config';
import type { Observation, ObservedTargetType, WindowInfo } from './types';
import type { RuntimeState } from './state';
import { ensureBrowser } from './native/browserRuntime';
import { listAccessibilityNodes } from './native/accessibility';
import { captureObservedScreenshot } from './native/screenshot';
import { handleTargetUrl } from './native/targetUrl';
import { bringWindowToTop, foregroundBrowserOwnedFileDialog, refreshWindow } from './native/windowsWindow';

const visibleWindow = (window: WindowInfo) => ({
  ...window,
  clientBounds: window.clientBounds || window.bounds,
});

const selectObservedTarget = async (browserWindow: WindowInfo) => {
  const dialog = await foregroundBrowserOwnedFileDialog(browserWindow);
  return dialog
    ? { target: visibleWindow(dialog), targetType: 'file-dialog' as const }
    : { target: visibleWindow(browserWindow), targetType: 'browser-window' as const };
};

export const createObservation = async (params: {
  state: RuntimeState;
  config: ServerConfig;
  targetUrl?: string;
  inlineImage?: boolean;
}): Promise<Observation> => {
  const ensured = await ensureBrowser(params.state, params.config);
  const beforeNavigation = await selectObservedTarget(ensured.window);
  const url = beforeNavigation.targetType === 'browser-window'
    ? await handleTargetUrl({
        config: params.config,
        window: ensured.window,
        targetUrl: params.targetUrl,
        launchedNow: ensured.launchedNow,
      })
    : { currentUrl: null, targetUrlStatus: params.targetUrl ? 'unknown' as const : 'not-provided' as const };
  const refreshedBrowser = await refreshWindow(ensured.window, ensured.browser.exe.path) || ensured.window;
  if (beforeNavigation.targetType === 'browser-window') await bringWindowToTop(refreshedBrowser.handle);
  const { target, targetType } = await selectObservedTarget(refreshedBrowser);
  const screenshot = await captureObservedScreenshot({ browser: refreshedBrowser, target, targetType });
  const accessibilityNodes = await listAccessibilityNodes(target, {
    width: screenshot.metadata.width,
    height: screenshot.metadata.height,
  });
  const capturedAt = new Date().toISOString();
  const observation: Observation = {
    sessionId: params.state.sessionId,
    observationToken: randomUUID(),
    observedTargetType: targetType as ObservedTargetType,
    currentUrl: url.currentUrl,
    targetUrlStatus: url.targetUrlStatus,
    screenshot: screenshot.metadata,
    screenshotPath: screenshot.screenshotPath,
    imageBase64: params.inlineImage === true ? screenshot.imageBase64 : undefined,
    accessibilityNodes,
    browser: refreshedBrowser,
    target,
    capturedAt,
    consumed: false,
    stale: false,
  };
  params.state.lastObservation = observation;
  params.state.browserWindow = refreshedBrowser;
  return observation;
};
