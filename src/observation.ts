import { randomUUID } from 'node:crypto';
import type { ServerConfig } from './config';
import type { Observation } from './types';
import type { RuntimeState } from './state';
import { ensureBrowser } from './native/browserRuntime';
import { captureCurrentTarget } from './native/currentTarget';
import { handleTargetUrl } from './native/targetUrl';
import { bringWindowToTop, foregroundBrowserOwnedFileDialog } from './native/windowsWindow';

export const createObservation = async (params: {
  state: RuntimeState;
  config: ServerConfig;
  targetUrl?: string;
  inlineImage?: boolean;
}): Promise<Observation> => {
  const ensured = await ensureBrowser(params.state, params.config);
  const dialog = await foregroundBrowserOwnedFileDialog(ensured.window);
  const url = dialog
    ? { currentUrl: null, targetUrlStatus: params.targetUrl ? 'unknown' as const : 'not-provided' as const }
    : await handleTargetUrl({
        config: params.config,
        window: ensured.window,
        targetUrl: params.targetUrl,
        launchedNow: ensured.launchedNow,
      });
  if (!dialog && !await bringWindowToTop(ensured.window.handle)) throw new Error('Browser window could not be made foreground; screenshot capture aborted.');
  const current = await captureCurrentTarget(ensured.window, params.config.screenshotsDir);
  const observation: Observation = {
    sessionId: params.state.sessionId,
    observationToken: randomUUID(),
    observedTargetType: current.targetType,
    currentUrl: url.currentUrl,
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
