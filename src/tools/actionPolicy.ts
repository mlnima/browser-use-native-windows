import type { ServerConfig } from '../config';
import type { NativeAction } from '../native/input/actionTypes';

const matchesUrlRule = (url: string, rule: string) => {
  const escaped = rule.trim().replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  return escaped.length > 0
    ? new RegExp(`^${escaped.split('*').join('.*')}$`, 'i').test(url)
    : false;
};

const blockedUrlError = (text: string, rules: string[]) => {
  const candidates = text ? [text, `http://${text}`, `https://${text}`] : [];
  const blocked = candidates.find((candidate) => rules.some((rule) => matchesUrlRule(candidate, rule)));
  return blocked ? `Browser URL is not allowed: ${text}` : '';
};

export const assertNativeActionAllowed = (action: NativeAction, config: ServerConfig) => {
  const text = action.kind === 'typeText'
    ? action.text
    : action.kind === 'fileDialogUpload'
      ? action.path
      : '';
  const blocked = blockedUrlError(text, config.blockedUrlRules);
  if (blocked) throw new Error(blocked);
};
