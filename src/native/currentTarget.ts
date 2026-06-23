import type { Observation } from '../types';
import { foregroundBrowserOwnedFileDialog, refreshWindow } from './windowsWindow';

export const refreshObservedTarget = async (observation: Observation): Promise<Observation> => {
  const browser = await refreshWindow(observation.browser, observation.browser.executablePath) || observation.browser;
  const target = observation.observedTargetType === 'file-dialog'
    ? await foregroundBrowserOwnedFileDialog(browser)
    : browser;
  if (!target) throw new Error('Observed browser-owned file dialog is no longer active.');
  const screenshot = {
    ...observation.screenshot,
    origin: { x: target.bounds.left, y: target.bounds.top },
    globalBounds: target.bounds,
    browserBounds: browser.bounds,
    browserClientBounds: observation.observedTargetType === 'browser-window' ? browser.clientBounds : observation.screenshot.browserClientBounds,
    fileDialogBounds: observation.observedTargetType === 'file-dialog' ? target.bounds : undefined,
  };
  return { ...observation, browser, target, screenshot };
};
