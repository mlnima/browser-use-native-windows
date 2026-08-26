import type { NativeInputMouseButton, Point } from '../../types';
import { runPowerShell } from '../processExec';
import { apiPrelude, escapePs } from '../windowsApi';
import { windowsKeyEntry, windowsNativeKeyCodes, type NativeWindowsKeyEntry } from './keyMap';
import type { NativeInputAdapter, NativeMouseMovement } from './types';

const mouseFlags: Record<NativeInputMouseButton, { down: number; up: number }> = {
  left: { down: 0x0002, up: 0x0004 },
  right: { down: 0x0008, up: 0x0010 },
  middle: { down: 0x0020, up: 0x0040 },
};

let lastDriverError: string | null = null;

const keyHoldMs = () => Math.round(12 + Math.random() * 24);

const runNativeScript = async (script: string, timeoutMs?: number) => {
  try {
    const result = await runPowerShell(`${apiPrelude()}
${script}`, timeoutMs);
    lastDriverError = null;
    return result;
  } catch (error) {
    lastDriverError = error instanceof Error ? error.message : String(error);
    throw error;
  }
};

const sendMouse = async (flags: number, x = 0, y = 0, data = 0) => {
  await runNativeScript(`[NativeBrowserUseApi]::SendMouse(${Math.round(x)}, ${Math.round(y)}, ${Math.round(data)}, ${flags})`);
};

const keyCall = (entry: NativeWindowsKeyEntry, down: boolean) =>
  `[NativeBrowserUseApi]::SendScanCode(${entry.code}, $${down ? 'false' : 'true'}, $${entry.special ? 'true' : 'false'})`;

const pressEntries = async (held: NativeWindowsKeyEntry[], entry: NativeWindowsKeyEntry) => {
  const shifted = entry.shift ? [windowsNativeKeyCodes.Shift!] : [];
  const down = [...held, ...shifted].map((item) => keyCall(item, true));
  const up = [entry, ...shifted.slice().reverse(), ...held.slice().reverse()].map((item) => keyCall(item, false));
  await runNativeScript(`try {
${[...down, keyCall(entry, true), `[Threading.Thread]::Sleep(${keyHoldMs()})`].join('\n')}
} finally {
${up.join('\n')}
}`);
};

const readCursorPosition = async (): Promise<Point | null> =>
  JSON.parse(await runNativeScript(`$point = New-Object POINT
[NativeBrowserUseApi]::GetCursorPos([ref]$point) | Out-Null
[PSCustomObject]@{x=[int]$point.X;y=[int]$point.Y} | ConvertTo-Json -Compress`) || 'null') as Point | null;

const moveMouseTo = async (x: number, y: number): Promise<NativeMouseMovement> =>
  JSON.parse(await runNativeScript(`$before = New-Object POINT
[NativeBrowserUseApi]::GetCursorPos([ref]$before) | Out-Null
$steps = [NativeBrowserUseApi]::MoveCursor(${Math.round(x)}, ${Math.round(y)})
$after = New-Object POINT
[NativeBrowserUseApi]::GetCursorPos([ref]$after) | Out-Null
[PSCustomObject]@{steps=[int]$steps;start=[PSCustomObject]@{x=[int]$before.X;y=[int]$before.Y};end=[PSCustomObject]@{x=[int]$after.X;y=[int]$after.Y}} | ConvertTo-Json -Depth 3 -Compress`, 30000)) as NativeMouseMovement;

export const createWindowsInputAdapter = (): NativeInputAdapter => ({
  platform: 'windows',
  moveMouseTo,
  clickMouseAt: async (button, point, holdMs) => {
    const flags = mouseFlags[button];
    await runNativeScript(`[NativeBrowserUseApi]::ClickMouseAt(${Math.round(point.x)}, ${Math.round(point.y)}, ${flags.down}, ${flags.up}, ${Math.max(1, Math.round(holdMs))})`);
  },
  mouseDown: async (button) => await sendMouse(mouseFlags[button].down),
  mouseUp: async (button) => await sendMouse(mouseFlags[button].up),
  scroll: async (delta) => await sendMouse(0x0800, 0, 0, delta),
  keyDown: async (key) => { await runNativeScript(keyCall(windowsKeyEntry(key), true)); },
  keyUp: async (key) => { await runNativeScript(keyCall(windowsKeyEntry(key), false)); },
  pressKey: async (key) => await pressEntries([], windowsKeyEntry(key)),
  pressKeyCombo: async (keys) => {
    const entries = keys.map(windowsKeyEntry);
    const last = entries.at(-1) || windowsNativeKeyCodes.Space!;
    await pressEntries(entries.slice(0, -1), last);
  },
  typeText: async (text) => {
    await runNativeScript(`[NativeBrowserUseApi]::SendUnicodeText('${escapePs(text)}')`);
  },
  getCursorPosition: readCursorPosition,
});

export const getWindowsInputDriverStatus = async () => {
  try {
    await runNativeScript(`$point = New-Object POINT
[NativeBrowserUseApi]::GetCursorPos([ref]$point) | Out-Null`);
    return { available: true, error: null };
  } catch (error) {
    return { available: false, error: error instanceof Error ? error.message : String(error) || lastDriverError };
  }
};
