import type { ServerConfig } from '../config';
import type { TargetUrlStatus, WindowInfo } from '../types';
import { actionAfterNavigationWaitMs } from '../defaults';
import { sleep } from '../util/time';
import { getNativeInputController } from './input/controller';
import { bringWindowToTop, getForegroundWindowHandle } from './windowsWindow';
import { readCurrentBrowserUrl, urlReached } from './urlReader';

export type TargetUrlResult = {
  currentUrl: string | null;
  targetUrlStatus: TargetUrlStatus;
};

const matchesUrlRule = (url: string, rule: string) => {
  const escaped = rule.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return escaped.length > 0
    ? new RegExp(`^${escaped.split('*').join('.*')}$`, 'i').test(url)
    : false;
};

const assertAllowedUrl = (url: string, rules: string[]) => {
  const candidates = [url, `http://${url}`, `https://${url}`];
  if (candidates.some((candidate) => rules.some((rule) => matchesUrlRule(candidate, rule)))) {
    throw new Error(`Browser URL is not allowed: ${url}`);
  }
};

const navigateWithNativeInput = async (window: WindowInfo, url: string) => {
  if (!await bringWindowToTop(window.handle)) throw new Error('Browser window could not be made foreground; navigation aborted.');
  const controller = getNativeInputController();
  await controller.pressKeyCombo(['Control', 'l']);
  if (await getForegroundWindowHandle() !== window.handle) throw new Error('Owned browser focus changed; navigation aborted.');
  await controller.typeText(url);
  await controller.pressKey('Enter');
  await sleep(actionAfterNavigationWaitMs);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const currentUrl = await readCurrentBrowserUrl(window);
    if (currentUrl && urlReached(currentUrl, url)) return currentUrl;
    await sleep(150);
  }
  throw new Error('Native browser navigation did not reach the requested URL.');
};

export const handleTargetUrl = async (params: {
  config: ServerConfig;
  window: WindowInfo;
  targetUrl?: string;
  launchedNow: boolean;
}): Promise<TargetUrlResult> => {
  const targetUrl = params.targetUrl?.trim();
  if (!targetUrl) return { currentUrl: await readCurrentBrowserUrl(params.window), targetUrlStatus: 'not-provided' };
  assertAllowedUrl(targetUrl, params.config.blockedUrlRules);
  const currentUrl = params.launchedNow ? null : await readCurrentBrowserUrl(params.window);
  if (currentUrl && urlReached(currentUrl, targetUrl)) return { currentUrl, targetUrlStatus: 'matched' };
  const navigatedUrl = await navigateWithNativeInput(params.window, targetUrl);
  return { currentUrl: navigatedUrl, targetUrlStatus: 'navigated' };
};
