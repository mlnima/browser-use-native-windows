import { observationSnapshotAttempts } from '../defaults';
import type { Bounds, MonitorInfo, Observation, ObservedTargetType, RunningBrowser, WindowInfo } from '../types';
import { boundsHeight, boundsWidth, contentBounds, intersectBounds, intersectBoundsArea, resizeLocalBounds, unionBounds } from './geometry';
import { listAccessibilityNodes } from './accessibility';
import { captureObservedScreenshot, visibleBounds } from './screenshot';
import { bringWindowToTop, foregroundBrowserOwnedFileDialog, getForegroundWindow, listDisplays, refreshWindow } from './windowsWindow';

const visibleWindow = (window: WindowInfo) => ({ ...window, clientBounds: window.clientBounds || window.bounds });
const sameBounds = (a: Bounds, b: Bounds) => a.left === b.left && a.top === b.top && a.right === b.right && a.bottom === b.bottom;
const sameMonitor = (a: MonitorInfo | null | undefined, b: MonitorInfo | null | undefined) =>
  a?.id === b?.id && a?.dpi === b?.dpi && a?.scale === b?.scale && !!a?.bounds && !!b?.bounds && sameBounds(a.bounds, b.bounds);
const sameWindow = (a: WindowInfo, b: WindowInfo) =>
  a.handle === b.handle && a.processId === b.processId && a.executablePath.toLowerCase() === b.executablePath.toLowerCase() &&
  a.className === b.className && a.dpi === b.dpi && sameBounds(a.bounds, b.bounds) &&
  sameBounds(a.clientBounds, b.clientBounds) && sameMonitor(a.monitor, b.monitor);
const readTarget = async (browser: WindowInfo) => {
  const currentBrowser = await refreshWindow(browser);
  if (!currentBrowser) throw new Error('Observed browser window is no longer available.');
  const dialog = await foregroundBrowserOwnedFileDialog(currentBrowser);
  return dialog
    ? { browser: currentBrowser, target: visibleWindow(dialog), targetType: 'file-dialog' as const }
    : { browser: currentBrowser, target: visibleWindow(currentBrowser), targetType: 'browser-window' as const };
};
const sameCapture = (before: Awaited<ReturnType<typeof readTarget>>, after: Awaited<ReturnType<typeof readTarget>>) =>
  before.targetType === after.targetType && sameWindow(before.browser, after.browser) && sameWindow(before.target, after.target);
const sameClientFrame = (a: WindowInfo, b: WindowInfo) =>
  boundsWidth(a.clientBounds) === boundsWidth(b.clientBounds) &&
  boundsHeight(a.clientBounds) === boundsHeight(b.clientBounds) &&
  a.clientBounds.left - a.bounds.left === b.clientBounds.left - b.bounds.left &&
  a.clientBounds.top - a.bounds.top === b.clientBounds.top - b.bounds.top;

export const captureCurrentTarget = async (browser: WindowInfo, screenshotsDir: string, expectedType?: ObservedTargetType) => {
  for (let attempt = 0; attempt < observationSnapshotAttempts; attempt += 1) {
    const before = await readTarget(browser);
    if (expectedType && before.targetType !== expectedType) throw new Error('Observed target changed; call browser_observe again.');
    if (!await bringWindowToTop(before.target.handle)) throw new Error('Observed target could not be made foreground; screenshot capture aborted.');
    const screenshot = await captureObservedScreenshot({ ...before, screenshotsDir });
    if (!sameMonitor(before.target.monitor, screenshot.metadata.monitor)) continue;
    const accessibilityNodes = await listAccessibilityNodes(before.target, screenshot.metadata.globalBounds, screenshot.metadata);
    const after = await readTarget(before.browser);
    const foreground = await getForegroundWindow();
    if (sameCapture(before, after) && foreground?.handle === before.target.handle) return { ...before, screenshot, accessibilityNodes };
    browser = after.browser;
  }
  throw new Error('Browser monitor, DPI, position, or size changed during capture; call browser_observe again.');
};

const sameCoordinateFrame = (observation: Observation, current: Awaited<ReturnType<typeof readTarget>>, globalBounds: Bounds) =>
  observation.observedTargetType === current.targetType &&
  boundsWidth(observation.screenshot.globalBounds) === boundsWidth(globalBounds) &&
  boundsHeight(observation.screenshot.globalBounds) === boundsHeight(globalBounds) &&
  sameClientFrame(observation.target, current.target) &&
  observation.screenshot.dpi === current.target.monitor?.dpi &&
  observation.target.dpi === current.target.dpi &&
  observation.target.monitor?.scale === current.target.monitor?.scale;

export const refreshObservedTarget = async (observation: Observation, ownedBrowser: RunningBrowser | null): Promise<Observation> => {
  if (!ownedBrowser?.launchedByMcp || observation.browser.handle !== ownedBrowser.windowHandle ||
    observation.browser.processId !== ownedBrowser.windowProcessId ||
    observation.browser.executablePath.toLowerCase() !== ownedBrowser.exe.path.toLowerCase()) {
    throw new Error('Observation does not belong to the browser launched by this MCP session.');
  }
  const current = await readTarget(observation.browser);
  if (current.targetType !== observation.observedTargetType) throw new Error('Observed target changed; call browser_observe again.');
  const displays = await listDisplays();
  const confirmed = await readTarget(current.browser);
  if (!sameCapture(current, confirmed)) throw new Error('Browser geometry changed before input; call browser_observe again.');
  const globalBounds = visibleBounds(current.target.clientBounds, displays);
  const monitors = displays.map((display, index) => ({ ...display, index, intersectionArea: intersectBoundsArea(globalBounds, display.bounds) }));
  const monitorIndex = monitors.findIndex((monitor) => monitor.id === current.target.monitor?.id);
  const monitor = monitors[monitorIndex] || null;
  if (!sameMonitor(current.target.monitor, monitor) || !sameCoordinateFrame(observation, current, globalBounds)) {
    throw new Error('Browser monitor scaling, screenshot size, or window size changed after browser_observe; call browser_observe again.');
  }
  return {
    ...observation,
    browser: current.browser,
    target: current.target,
    screenshot: {
      ...observation.screenshot,
      origin: { x: globalBounds.left, y: globalBounds.top },
      globalBounds,
      browserBounds: visibleBounds(current.browser.clientBounds, displays),
      browserClientBounds: current.targetType === 'browser-window' ? globalBounds : undefined,
      fileDialogBounds: current.targetType === 'file-dialog' ? globalBounds : undefined,
      contentBounds: current.targetType === 'browser-window'
        ? resizeLocalBounds(
            contentBounds(globalBounds, intersectBounds(current.browser.clientBounds, globalBounds) || globalBounds),
            { width: boundsWidth(globalBounds), height: boundsHeight(globalBounds) },
            observation.screenshot,
          )
        : undefined,
      virtualBounds: unionBounds(displays.map((display) => display.bounds)),
      monitorIndex,
      monitor,
      dpi: monitor.dpi || current.target.dpi || null,
      monitors,
    },
  };
};
