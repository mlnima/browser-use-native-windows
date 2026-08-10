import { createRequire } from 'node:module';
import type { Bounds, NativeInputMouseButton, Point } from '../../types';
import { runPowerShell, runPowerShellJson } from '../processExec';
import { apiPrelude, escapePs } from '../windowsApi';
import { windowsNativeKeyCodes, type NativeWindowsKeyEntry } from './keyMap';
import type { NativeInputAdapter } from './types';
import { sleep } from '../../util/time';

type InterceptionDevice = {
  send: (stroke: Record<string, unknown>) => boolean;
};

type InterceptionSession = {
  getMice: () => InterceptionDevice[];
  isDestroyed: () => boolean;
};

type InterceptionModule = {
  Interception: new () => InterceptionSession;
  KeyState: Record<string, number>;
  MouseFlag: Record<string, number>;
  MouseState: Record<string, number>;
};

const require = createRequire(import.meta.url);
const mouseFlags: Record<NativeInputMouseButton, { down: number; up: number }> = {
  left: { down: 1, up: 2 },
  right: { down: 4, up: 8 },
  middle: { down: 16, up: 32 },
};

let interceptionSession: InterceptionSession | null = null;
let interceptionModule: InterceptionModule | null = null;
let mouseDevice: InterceptionDevice | null = null;
let lastDriverError: string | null = null;

const unavailableMessage = (type: string) =>
  `node-interception ${type} device not available. Install the driver as admin with "npx node-interception /install", reboot Windows, then restart the MCP.`;

const keyHoldMs = () =>
  Math.round(14 + Math.random() * 52);

const getInterception = () => {
  try {
    interceptionModule ??= require('node-interception') as InterceptionModule;
    if (!interceptionSession || interceptionSession.isDestroyed()) {
      interceptionSession = new interceptionModule.Interception();
      mouseDevice = null;
    }
    lastDriverError = null;
    return { api: interceptionModule, session: interceptionSession };
  } catch (error) {
    lastDriverError = error instanceof Error ? error.message : String(error);
    throw new Error(`node-interception is not available: ${lastDriverError}`);
  }
};

const getMouseDevice = () => {
  const { session } = getInterception();
  const device = mouseDevice || session.getMice()[0] || null;
  if (!device) throw new Error(unavailableMessage('mouse'));
  mouseDevice = device;
  return device;
};

const sendMouse = (state: number, x = 0, y = 0, rolling = 0, flags?: number) => {
  const { api } = getInterception();
  const ok = getMouseDevice().send({
    type: 'mouse',
    flags: flags ?? api.MouseFlag.MOVE_RELATIVE,
    rolling,
    x: Math.round(x),
    y: Math.round(y),
    state,
    information: 0,
  });
  if (!ok) throw new Error('node-interception mouse send failed.');
};

const absoluteAxis = (value: number, minimum: number, maximum: number) => {
  const size = maximum - minimum;
  if (size <= 1) throw new Error('Virtual desktop bounds are unavailable.');
  const clamped = Math.min(Math.max(Math.round(value), minimum), maximum - 1);
  return Math.round((clamped - minimum) * 65535 / (size - 1));
};

const keyEntry = (key: string) => {
  const normalized = key === 'Return'
    ? 'Enter'
    : key.startsWith('Arrow')
      ? key.slice('Arrow'.length)
      : key;
  const entry = windowsNativeKeyCodes[normalized];
  if (!entry) throw new Error(`Unsupported native input key: ${key}`);
  return entry;
};

const sendKeyCode = async (entry: NativeWindowsKeyEntry, down: boolean) => {
  await runPowerShell(`${apiPrelude()}
[NativeBrowserUseApi]::SendScanCode(${entry.code}, $${down ? 'false' : 'true'}, $${entry.special ? 'true' : 'false'})`);
};

const releaseKeyEntries = async (entries: NativeWindowsKeyEntry[]) => {
  const errors: string[] = [];
  for (const entry of entries.slice().reverse()) {
    try {
      await sendKeyCode(entry, false);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (errors.length > 0) throw new Error(`node-interception keyboard release failed: ${errors.join('; ')}`);
};

const pressEntry = async (entry: NativeWindowsKeyEntry) => {
  const shift = entry.shift ? [windowsNativeKeyCodes.Shift!] : [];
  try {
    for (const item of shift) await sendKeyCode(item, true);
    await sendKeyCode(entry, true);
    await sleep(keyHoldMs());
  } finally {
    await releaseKeyEntries([...shift, entry]);
  }
};

const readCursorPosition = async (): Promise<Point | null> =>
  await runPowerShellJson<Point | null>(`${apiPrelude()}
$point = New-Object POINT
[NativeBrowserUseApi]::GetCursorPos([ref]$point) | Out-Null
[PSCustomObject]@{x=[int]$point.X;y=[int]$point.Y} | ConvertTo-Json -Compress`, null);

export const createWindowsInputAdapter = (): NativeInputAdapter => ({
  platform: 'windows',
  moveMouseRelative: async (dx, dy) => sendMouse(0, dx, dy),
  moveMouseAbsolute: async (x, y, desktopBounds: Bounds) => {
    const flags = getInterception().api.MouseFlag;
    sendMouse(
      0,
      absoluteAxis(x, desktopBounds.left, desktopBounds.right),
      absoluteAxis(y, desktopBounds.top, desktopBounds.bottom),
      0,
      flags.MOVE_ABSOLUTE | flags.VIRTUAL_DESKTOP,
    );
  },
  mouseDown: async (button) => sendMouse(mouseFlags[button].down),
  mouseUp: async (button) => sendMouse(mouseFlags[button].up),
  scroll: async (delta) => sendMouse(getInterception().api.MouseState.WHEEL, 0, 0, Math.round(delta)),
  keyDown: async (key) => { await sendKeyCode(keyEntry(key), true); },
  keyUp: async (key) => { await sendKeyCode(keyEntry(key), false); },
  pressKey: async (key) => await pressEntry(keyEntry(key)),
  pressKeyCombo: async (keys) => {
    const entries = keys.map(keyEntry);
    const held = entries.slice(0, -1);
    try {
      for (const entry of held) await sendKeyCode(entry, true);
      await pressEntry(entries[entries.length - 1] || windowsNativeKeyCodes.Space!);
    } finally {
      await releaseKeyEntries(held);
    }
  },
  typeText: async (text) => {
    await runPowerShell(`${apiPrelude()}
[NativeBrowserUseApi]::SendUnicodeText('${escapePs(text)}')`);
  },
  getCursorPosition: readCursorPosition,
});

export const getWindowsInputDriverStatus = () => {
  try {
    getMouseDevice();
    return { available: true, error: null };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : String(error) || lastDriverError };
  }
};
