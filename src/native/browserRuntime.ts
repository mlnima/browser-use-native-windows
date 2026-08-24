import fs from 'node:fs';
import { spawn } from 'node:child_process';
import type { ServerConfig } from '../config';
import type { BrowserExecutable } from '../types';
import type { RuntimeState } from '../state';
import { browserWindowFindAttempts, browserWindowFindDelayMs } from '../defaults';
import { sleep } from '../util/time';
import { listBrowserExecutables } from './browserExecutable';
import { runTextCommand } from './processExec';
import { closeWindowByHandle, findWindowsBrowserWindow, listWindowsBrowserHandles } from './windowsWindow';

const launchArgs = (config: ServerConfig, launchUrl: string) => [
  `--user-data-dir=${config.browserUserDataDir}`,
  '--new-window',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-session-crashed-bubble',
  '--hide-crash-restore-bubble',
  ...(config.noSandbox ? ['--no-sandbox', '--disable-setuid-sandbox'] : []),
  ...config.browserExtraArgs,
  launchUrl,
];

const waitForWindow = async (exe: BrowserExecutable, previousHandles: Set<string>) => {
  for (let attempt = 0; attempt < browserWindowFindAttempts; attempt += 1) {
    const handles = await listWindowsBrowserHandles(exe.path);
    for (const handle of handles.filter((entry) => !previousHandles.has(entry))) {
      const window = await findWindowsBrowserWindow({ handle, executablePath: exe.path });
      if (window) return window;
    }
    await sleep(browserWindowFindDelayMs);
  }
  return null;
};

const launchBrowser = async (exe: BrowserExecutable, config: ServerConfig) => {
  fs.mkdirSync(config.browserUserDataDir, { recursive: true });
  const launchUrl = 'about:blank';
  const previousHandles = new Set(await listWindowsBrowserHandles(exe.path));
  const args = launchArgs(config, launchUrl);
  const proc = spawn(exe.path, args, { stdio: 'ignore', windowsHide: false, detached: false });
  const window = await waitForWindow(exe, previousHandles);
  if (!window) {
    if (proc.exitCode === null && !proc.killed) proc.kill();
    throw new Error('Browser launched, but its exact process window was not detected.');
  }
  return {
    browser: {
      pid: window.processId,
      windowHandle: window.handle,
      windowProcessId: window.processId,
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
  const tracked = current?.launchedByMcp
    ? await findWindowsBrowserWindow({ handle: current.windowHandle, pid: current.windowProcessId, executablePath: current.exe.path })
    : null;
  if (current && tracked) {
    state.browserWindow = { handle: tracked.handle };
    return { browser: current, window: tracked, launchedNow: false };
  }
  if (current?.launchedByMcp && current.proc?.exitCode === null && !current.proc.killed) current.proc.kill();
  const launched = await launchBrowser(executables[0]!, config);
  state.browser = launched.browser;
  state.browserWindow = { handle: launched.window.handle };
  return { ...launched, launchedNow: true };
};

export const closeRuntimeBrowser = async (state: RuntimeState) => {
  const browser = state.browser?.launchedByMcp ? state.browser : null;
  const handle = browser?.windowHandle || '';
  if (!handle) return { closed: false, error: 'No MCP-launched browser HWND is available.' };
  const posted = await closeWindowByHandle(handle);
  if (posted) await sleep(250);
  let remaining = await findWindowsBrowserWindow({
    handle,
    pid: browser!.windowProcessId,
    executablePath: browser!.exe.path,
  });
  if (remaining && browser?.proc?.pid === browser.windowProcessId) {
    await runTextCommand('taskkill', ['/PID', String(browser!.windowProcessId), '/T', '/F']).catch(() => '');
    await sleep(100);
    remaining = await findWindowsBrowserWindow({
      handle,
      pid: browser!.windowProcessId,
      executablePath: browser!.exe.path,
    });
  }
  const proc = browser?.proc;
  if (proc && proc.exitCode === null && !proc.killed) proc.kill();
  state.browser = null;
  state.browserWindow = null;
  state.lastObservation = null;
  return { closed: !remaining, error: remaining ? 'Browser could not be closed.' : null };
};
