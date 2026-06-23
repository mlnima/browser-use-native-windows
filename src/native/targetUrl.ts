import type { ServerConfig } from '../config';
import type { TargetUrlStatus, WindowInfo } from '../types';
import { actionAfterNavigationWaitMs } from '../defaults';
import { sleep } from '../util/time';
import { getNativeInputController } from './input/controller';
import { bringWindowToTop } from './windowsWindow';
import { readCurrentBrowserUrl, urlsMatch } from './urlReader';

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
  await bringWindowToTop(window.handle);
  const controller = getNativeInputController();
  await controller.pressKeyCombo(['Control', 'l']);
  await controller.typeText(url);
  await controller.pressKey('Enter');
  await sleep(actionAfterNavigationWaitMs);
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
  if (currentUrl && urlsMatch(currentUrl, targetUrl)) return { currentUrl, targetUrlStatus: 'matched' };
  if (!params.launchedNow && !currentUrl) return { currentUrl: null, targetUrlStatus: 'unknown' };
  await navigateWithNativeInput(params.window, targetUrl);
  return { currentUrl: targetUrl, targetUrlStatus: 'navigated' };
};
