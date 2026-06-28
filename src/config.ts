import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  defaultSseAuth,
  defaultSseHost,
  defaultSsePort,
  defaultUserDataDir,
  defaultForceStopHotkey,
  logDir,
  runtimeDir,
  screenshotDir,
} from './defaults';

export type ServerConfig = {
  sseHost: string;
  ssePort: number;
  sseAuth: string;
  logDir: string;
  screenshotsDir: string;
  browserExecutablePath: string;
  browserUserDataDir: string;
  browserExtraArgs: string[];
  noSandbox: boolean;
  blockedUrlRules: string[];
  forceStopHotkey: string;
  disableForceStopHotkey: boolean;
};

const envPrefixes = ['BROWSER_USE_NATIVE_WINDOWS_', 'COMPUTER_USE_WINDOWS_'];
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const envFilePath = path.join(moduleDir, '..', '.env');

const envValue = (value: string) => {
  const trimmed = value.trim();
  const quote = trimmed[0];
  return (quote === '"' || quote === "'") && trimmed.endsWith(quote)
    ? trimmed.slice(1, -1)
    : trimmed;
};

const loadEnvFile = () => {
  if (!fs.existsSync(envFilePath)) return {};
  const entries: Record<string, string> = {};
  for (const line of fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    const separator = trimmed.indexOf('=');
    const key = separator > 0 ? trimmed.slice(0, separator).trim() : '';
    if (!envPrefixes.some((prefix) => key.startsWith(prefix))) continue;
    entries[key] = envValue(trimmed.slice(separator + 1));
  }
  return entries;
};

const envFile = loadEnvFile();

const envString = (key: string) =>
  typeof process.env[key] === 'string' && process.env[key]!.trim().length > 0
    ? process.env[key]!.trim()
    : envFile[key]?.trim() || '';

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

const envPath = (key: string, fallback: string) => {
  const value = envString(key) || fallback;
  return path.resolve(path.isAbsolute(value) ? value : path.join(runtimeDir(), value));
};

export const loadConfig = (): ServerConfig => ({
  sseHost: envString('BROWSER_USE_NATIVE_WINDOWS_SSE_HOST') || defaultSseHost,
  ssePort: envPort('BROWSER_USE_NATIVE_WINDOWS_SSE_PORT'),
  sseAuth: envString('BROWSER_USE_NATIVE_WINDOWS_SSE_AUTH') || defaultSseAuth,
  logDir: envPath('COMPUTER_USE_WINDOWS_LOG_DIR', logDir()),
  screenshotsDir: envPath('COMPUTER_USE_WINDOWS_SCREENSHOTS_DIR', screenshotDir()),
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
