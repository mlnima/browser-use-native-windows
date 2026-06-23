import fs from 'node:fs';
import { spawn } from 'node:child_process';
import type { ServerConfig } from '../config';
import type { BrowserExecutable, RunningBrowser, WindowInfo } from '../types';
import type { RuntimeState } from '../state';
import { browserWindowFindAttempts, browserWindowFindDelayMs } from '../defaults';
import { sleep } from '../util/time';
import { listBrowserExecutables } from './browserExecutable';
import { findWindowsBrowserWindow } from './windowsWindow';

const launchArgs = (config: ServerConfig) => [
  `--user-data-dir=${config.browserUserDataDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-session-crashed-bubble',
  '--hide-crash-restore-bubble',
  ...(config.noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
  ...config.browserExtraArgs,
  'about:blank',
];

const runningFromWindow = (exe: BrowserExecutable, window: WindowInfo): RunningBrowser => ({
  pid: window.processId,
  exe,
  userDataDir: '',
  startedAt: Date.now(),
  launchedByMcp: false,
  args: [],
});

const findExistingBrowserWindow = async (executables: BrowserExecutable[]) => {
  for (const exe of executables) {
    const window = await findWindowsBrowserWindow({ executablePath: exe.path });
    if (window) return { exe, window };
  }
  return null;
};

const waitForWindow = async (exe: BrowserExecutable, pid?: number) => {
  for (let attempt = 0; attempt < browserWindowFindAttempts; attempt += 1) {
    const window = await findWindowsBrowserWindow({ pid, executablePath: exe.path }) ||
      await findWindowsBrowserWindow({ executablePath: exe.path });
    if (window) return window;
    await sleep(browserWindowFindDelayMs);
  }
  return null;
};

const launchBrowser = async (exe: BrowserExecutable, config: ServerConfig) => {
  fs.mkdirSync(config.browserUserDataDir, { recursive: true });
  const args = launchArgs(config);
  const proc = spawn(exe.path, args, { stdio: 'ignore', windowsHide: false, detached: false });
  const window = await waitForWindow(exe, proc.pid);
  if (!window) throw new Error('Browser launched, but no usable browser window was detected.');
  return {
    browser: {
      pid: proc.pid || window.processId,
      exe,
      userDataDir: config.browserUserDataDir,
      startedAt: Date.now(),
      launchedByMcp: true,
      args,
      proc,
    },
    window,
  };
};

export const ensureBrowser = async (state: RuntimeState, config: ServerConfig) => {
  if (process.platform !== 'win32') throw new Error('browser-use-native-windows only supports Windows.');
  const executables = await listBrowserExecutables(config);
  if (executables.length === 0) throw new Error('No supported Chromium-based browser found on Windows.');
  const current = state.browser;
  const tracked = current
    ? await waitForWindow(current.exe, current.pid)
    : null;
  if (current && tracked) {
    state.browserWindow = tracked;
    return { browser: current, window: tracked, launchedNow: false };
  }
  const existing = await findExistingBrowserWindow(executables);
  if (existing) {
    const browser = runningFromWindow(existing.exe, existing.window);
    state.browser = browser;
    state.browserWindow = existing.window;
    return { browser, window: existing.window, launchedNow: false };
  }
  const launched = await launchBrowser(executables[0]!, config);
  state.browser = launched.browser;
  state.browserWindow = launched.window;
  return { ...launched, launchedNow: true };
};
