import { randomUUID } from 'node:crypto';
import type { ServerConfig } from './config';
import type { Observation } from './types';
import type { RuntimeState } from './state';
import { ensureBrowser } from './native/browserRuntime';
import { captureCurrentTarget } from './native/currentTarget';
import { handleTargetUrl } from './native/targetUrl';
import { capturePageVisual, readPageVisual, waitForPageLoad } from './native/pageLoad';
import { bringWindowToTop, foregroundBrowserOwnedFileDialog } from './native/windowsWindow';
import { readCurrentBrowserUrl } from './native/urlReader';

export const createObservation = async (params: {
  state: RuntimeState;
  config: ServerConfig;
  targetUrl?: string;
  inlineImage?: boolean;
  previousObservation?: Observation;
  pageLoadStartedAt?: number;
  waitForLoad?: boolean;
}): Promise<Observation> => {
  const ensured = await ensureBrowser(params.state, params.config);
  const dialog = await foregroundBrowserOwnedFileDialog(ensured.window);
  const navigationBaseline = !dialog && params.targetUrl
    ? await capturePageVisual(ensured.window)
    : null;
  const actionBaseline = !dialog && params.waitForLoad && params.previousObservation?.observedTargetType === 'browser-window'
    ? await readPageVisual(params.previousObservation.screenshotPath)
    : null;
  const url = dialog
    ? { currentUrl: null, targetUrlStatus: params.targetUrl ? 'unknown' as const : 'not-provided' as const, loadStartedAt: null }
    : await handleTargetUrl({
        config: params.config,
        window: ensured.window,
        targetUrl: params.targetUrl,
        launchedNow: ensured.launchedNow,
      });
  const shouldWaitForLoad = !dialog && (url.targetUrlStatus === 'navigated' || params.waitForLoad === true);
  let currentUrl = url.currentUrl;
  if (shouldWaitForLoad) {
    currentUrl = await waitForPageLoad({
      window: ensured.window,
      baseline: navigationBaseline || actionBaseline,
      previousUrl: params.previousObservation?.currentUrl || null,
      currentUrl,
      readCurrentUrl: async () => await readCurrentBrowserUrl(ensured.window),
      startedAt: url.loadStartedAt || params.pageLoadStartedAt || Date.now(),
      timeoutMs: params.config.pageLoadTimeoutMs,
      required: url.targetUrlStatus === 'navigated',
    });
  }
  if (!dialog && !await bringWindowToTop(ensured.window.handle)) throw new Error('Browser window could not be made foreground; screenshot capture aborted.');
  const current = await captureCurrentTarget(ensured.window, params.config.screenshotsDir);
  const observation: Observation = {
    sessionId: params.state.sessionId,
    observationToken: randomUUID(),
    observedTargetType: current.targetType,
    currentUrl,
    targetUrlStatus: url.targetUrlStatus,
    screenshot: current.screenshot.metadata,
    screenshotPath: current.screenshot.screenshotPath,
    imageBase64: params.inlineImage === false ? undefined : current.screenshot.imageBase64,
    accessibilityNodes: current.accessibilityNodes,
    browser: current.browser,
    target: current.target,
    capturedAt: current.screenshot.metadata.capturedAt,
    consumed: false,
    stale: false,
  };
  params.state.lastObservation = { ...observation, imageBase64: undefined };
  params.state.browserWindow = { handle: current.browser.handle };
  return observation;
};
