import fs from 'node:fs';
import path from 'node:path';
import type { BrowserExecutable, BrowserKind } from '../types';
import type { ServerConfig } from '../config';
import { runTextCommandOrEmpty } from './processExec';

const chromiumExeNames = new Set([
  'chrome.exe',
  'msedge.exe',
  'brave.exe',
  'brave-browser.exe',
  'chromium.exe',
  'vivaldi.exe',
  'opera.exe',
  'launcher.exe',
  'yandex.exe',
  'yandexbrowser.exe',
]);

const exists = (filePath: string) => {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
};

const inferKind = (filePath: string): BrowserKind => {
  const lower = path.basename(filePath).toLowerCase();
  const full = filePath.toLowerCase();
  return lower.includes('brave') || full.includes('bravesoftware')
    ? 'brave'
    : lower.includes('edge') || lower.includes('msedge') || full.includes('microsoft\\edge')
      ? 'edge'
      : full.includes('chromium')
        ? 'chromium'
        : full.includes('sxs') || full.includes('canary')
          ? 'canary'
          : 'chrome';
};

const readWindowsProgId = async () => {
  const output = await runTextCommandOrEmpty('reg', [
    'query',
    'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice',
    '/v',
    'ProgId',
  ]);
  return output.match(/ProgId\s+REG_\w+\s+(.+)$/im)?.[1]?.trim() || '';
};

const readWindowsCommandForProgId = async (progId: string) => {
  const key = progId === 'http'
    ? 'HKCR\\http\\shell\\open\\command'
    : `HKCR\\${progId}\\shell\\open\\command`;
  const output = await runTextCommandOrEmpty('reg', ['query', key, '/ve']);
  return output.match(/REG_\w+\s+(.+)$/im)?.[1]?.trim() || '';
};

const expandWindowsEnvVars = (value: string) =>
  value.replace(/%([^%]+)%/g, (match, name) => {
    const key = String(name || '').trim();
    return key ? process.env[key] || match : match;
  });

const extractWindowsExecutablePath = (command: string) =>
  command.match(/"([^"]+\.exe)"/i)?.[1] || command.match(/([^\s]+\.exe)/i)?.[1] || '';

const detectDefaultBrowser = async (): Promise<BrowserExecutable | null> => {
  const progId = await readWindowsProgId();
  const command = (progId ? await readWindowsCommandForProgId(progId) : '') ||
    await readWindowsCommandForProgId('http');
  const exePath = extractWindowsExecutablePath(expandWindowsEnvVars(command));
  const exeName = path.win32.basename(exePath).toLowerCase();
  return exePath && exists(exePath) && chromiumExeNames.has(exeName)
    ? { kind: inferKind(exePath), path: exePath }
    : null;
};

const fallbackCandidates = () => {
  const localAppData = process.env.LOCALAPPDATA || '';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const joinWin = path.win32.join;
  return [
    localAppData && joinWin(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    localAppData && joinWin(localAppData, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    localAppData && joinWin(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    localAppData && joinWin(localAppData, 'Chromium', 'Application', 'chrome.exe'),
    localAppData && joinWin(localAppData, 'Google', 'Chrome SxS', 'Application', 'chrome.exe'),
    joinWin(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    joinWin(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    joinWin(programFiles, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    joinWin(programFilesX86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    joinWin(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    joinWin(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean) as string[];
};

const uniqueExecutables = (entries: BrowserExecutable[]) => {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = path.win32.normalize(entry.path).toLowerCase();
    const keep = !seen.has(key);
    seen.add(key);
    return keep;
  });
};

export const listBrowserExecutables = async (config: ServerConfig): Promise<BrowserExecutable[]> => {
  if (config.browserExecutablePath) {
    if (!exists(config.browserExecutablePath)) {
      throw new Error(`Browser executable not found: ${config.browserExecutablePath}`);
    }
    return [{ kind: 'custom', path: config.browserExecutablePath }];
  }
  const detected = await detectDefaultBrowser();
  const fallbacks = fallbackCandidates()
    .filter(exists)
    .map((candidate) => ({ kind: inferKind(candidate), path: candidate }));
  return uniqueExecutables(detected ? [detected, ...fallbacks] : fallbacks);
};

export const resolveBrowserExecutable = async (config: ServerConfig): Promise<BrowserExecutable> => {
  const executables = await listBrowserExecutables(config);
  if (executables[0]) return executables[0];
  throw new Error('No supported Chromium-based browser found on Windows.');
};
