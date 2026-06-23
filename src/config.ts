import path from 'node:path';
import {
  defaultSseAuth,
  defaultSseHost,
  defaultSsePort,
  defaultUserDataDir,
  defaultForceStopHotkey,
} from './defaults';

export type ServerConfig = {
  sseHost: string;
  ssePort: number;
  sseAuth: string;
  browserExecutablePath: string;
  browserUserDataDir: string;
  browserExtraArgs: string[];
  noSandbox: boolean;
  blockedUrlRules: string[];
  forceStopHotkey: string;
  disableForceStopHotkey: boolean;
};

const envString = (key: string) =>
  typeof process.env[key] === 'string' && process.env[key]!.trim().length > 0
    ? process.env[key]!.trim()
    : '';

const envBoolean = (key: string) => {
  const value = envString(key).toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
};

const envPort = (key: string) => {
  const raw = Number(envString(key));
  return Number.isInteger(raw) && raw > 0 && raw < 65536 ? raw : defaultSsePort;
};

const splitArgs = (value: string) =>
  value.match(/(?:"[^"]+"|'[^']+'|\S+)/g)?.map((entry) =>
    entry.replace(/^["']|["']$/g, ''),
  ) || [];

export const loadConfig = (): ServerConfig => ({
  sseHost: envString('BROWSER_USE_NATIVE_WINDOWS_SSE_HOST') || defaultSseHost,
  ssePort: envPort('BROWSER_USE_NATIVE_WINDOWS_SSE_PORT'),
  sseAuth: envString('BROWSER_USE_NATIVE_WINDOWS_SSE_AUTH') || defaultSseAuth,
  browserExecutablePath: envString('BROWSER_USE_NATIVE_WINDOWS_BROWSER_EXECUTABLE_PATH'),
  browserUserDataDir: path.resolve(
    envString('BROWSER_USE_NATIVE_WINDOWS_BROWSER_USER_DATA_DIR') || defaultUserDataDir(),
  ),
  browserExtraArgs: splitArgs(envString('BROWSER_USE_NATIVE_WINDOWS_BROWSER_EXTRA_ARGS')),
  noSandbox: envBoolean('BROWSER_USE_NATIVE_WINDOWS_NO_SANDBOX'),
  blockedUrlRules: envString('BROWSER_USE_NATIVE_WINDOWS_BLOCKED_URL_RULES')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean),
  forceStopHotkey: envString('BROWSER_USE_NATIVE_WINDOWS_FORCE_STOP_HOTKEY') || defaultForceStopHotkey,
  disableForceStopHotkey: envBoolean('BROWSER_USE_NATIVE_WINDOWS_DISABLE_FORCE_STOP_HOTKEY'),
});
