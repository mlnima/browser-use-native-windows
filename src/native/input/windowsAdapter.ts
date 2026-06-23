import { createRequire } from 'node:module';
import type { NativeInputMouseButton, Point } from '../../types';
import { runPowerShellJson } from '../processExec';
import { apiPrelude } from '../windowsApi';
import { windowsNativeKeyCodes, type NativeWindowsKeyEntry } from './keyMap';
import type { NativeInputAdapter } from './types';
import { sleep } from '../../util/time';

type InterceptionDevice = {
  send: (stroke: Record<string, unknown>) => boolean;
};

type InterceptionSession = {
  getMice: () => InterceptionDevice[];
  getKeyboards: () => InterceptionDevice[];
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
let keyboardDevice: InterceptionDevice | null = null;
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
      keyboardDevice = null;
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

const getKeyboardDevice = () => {
  const { session } = getInterception();
  const device = keyboardDevice || session.getKeyboards()[0] || null;
  if (!device) throw new Error(unavailableMessage('keyboard'));
  keyboardDevice = device;
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

const sendKeyCode = (entry: NativeWindowsKeyEntry, down: boolean) => {
  const { api } = getInterception();
  const state = down
    ? entry.special ? api.KeyState.E0 : api.KeyState.DOWN
    : (entry.special ? api.KeyState.E0 : 0) | api.KeyState.UP;
  const ok = getKeyboardDevice().send({ type: 'keyboard', code: entry.code, state, information: 0 });
  if (!ok) throw new Error('node-interception keyboard send failed.');
};

const releaseKeyEntries = (entries: NativeWindowsKeyEntry[]) => {
  const errors: string[] = [];
  for (const entry of entries.slice().reverse()) {
    try {
      sendKeyCode(entry, false);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (errors.length > 0) throw new Error(`node-interception keyboard release failed: ${errors.join('; ')}`);
};

const pressEntry = async (entry: NativeWindowsKeyEntry) => {
  const shift = entry.shift ? [windowsNativeKeyCodes.Shift!] : [];
  try {
    for (const item of shift) sendKeyCode(item, true);
    sendKeyCode(entry, true);
    await sleep(keyHoldMs());
  } finally {
    releaseKeyEntries([...shift, entry]);
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
  mouseDown: async (button) => sendMouse(mouseFlags[button].down),
  mouseUp: async (button) => sendMouse(mouseFlags[button].up),
  scroll: async (delta) => sendMouse(getInterception().api.MouseState.WHEEL, 0, 0, Math.round(delta)),
  keyDown: async (key) => sendKeyCode(keyEntry(key), true),
  keyUp: async (key) => sendKeyCode(keyEntry(key), false),
  pressKey: async (key) => await pressEntry(keyEntry(key)),
  pressKeyCombo: async (keys) => {
    const entries = keys.map(keyEntry);
    const held = entries.slice(0, -1);
    try {
      for (const entry of held) sendKeyCode(entry, true);
      await pressEntry(entries[entries.length - 1] || windowsNativeKeyCodes.Space!);
    } finally {
      releaseKeyEntries(held);
    }
  },
  typeText: async (text) => {
    for (const character of text) await pressEntry(keyEntry(character));
  },
  getCursorPosition: readCursorPosition,
});

export const getWindowsInputDriverStatus = () => {
  try {
    getMouseDevice();
    getKeyboardDevice();
    return { available: true, error: null };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : String(error) || lastDriverError };
  }
};
