import { spawn, type ChildProcess } from 'node:child_process';
import type { ServerConfig } from '../config';
import { logError } from '../log';

export type ForceStopHotkeyHandle = {
  stop: () => void;
};

const modifierMap: Record<string, number> = {
  alt: 0x0001,
  control: 0x0002,
  ctrl: 0x0002,
  shift: 0x0004,
  win: 0x0008,
  windows: 0x0008,
  meta: 0x0008,
};

const keyMap: Record<string, number> = {
  escape: 0x1b,
  esc: 0x1b,
  pause: 0x13,
  end: 0x23,
  home: 0x24,
  delete: 0x2e,
  f1: 0x70,
  f2: 0x71,
  f3: 0x72,
  f4: 0x73,
  f5: 0x74,
  f6: 0x75,
  f7: 0x76,
  f8: 0x77,
  f9: 0x78,
  f10: 0x79,
  f11: 0x7a,
  f12: 0x7b,
};

const parseHotkey = (value: string) => {
  const tokens = value.split('+').map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  const keyToken = tokens.find((entry) => keyMap[entry]);
  const modifiers = tokens.reduce((total, entry) => total | (modifierMap[entry] || 0), 0);
  const key = keyToken ? keyMap[keyToken] : 0;
  if (!key || modifiers === 0) throw new Error(`Invalid force-stop hotkey: ${value}`);
  return { modifiers, key };
};

const watchdogScript = (parentPid: number, modifiers: number, key: number) => `
$source = @"
using System;
using System.Runtime.InteropServices;
public static class HotkeyWatchdogApi {
  [StructLayout(LayoutKind.Sequential)] public struct MSG { public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public int x; public int y; }
  [DllImport("user32.dll")] public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
  [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
  [DllImport("user32.dll")] public static extern bool PeekMessage(out MSG msg, IntPtr hWnd, uint min, uint max, uint remove);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
}
"@
Add-Type -TypeDefinition $source
$id = 38177
$parentPid = ${parentPid}
$registered = [HotkeyWatchdogApi]::RegisterHotKey([IntPtr]::Zero, $id, ${modifiers}, ${key})
if (-not $registered) { exit 23 }
function Release-AllInput {
  for ($vk = 1; $vk -le 254; $vk++) { [HotkeyWatchdogApi]::keybd_event([byte]$vk, 0, 0x0002, [UIntPtr]::Zero) }
  [HotkeyWatchdogApi]::mouse_event(0x0004, 0, 0, 0, [UIntPtr]::Zero)
  [HotkeyWatchdogApi]::mouse_event(0x0010, 0, 0, 0, [UIntPtr]::Zero)
  [HotkeyWatchdogApi]::mouse_event(0x0040, 0, 0, 0, [UIntPtr]::Zero)
}
try {
  while ($true) {
    $msg = New-Object HotkeyWatchdogApi+MSG
    while ([HotkeyWatchdogApi]::PeekMessage([ref]$msg, [IntPtr]::Zero, 0, 0, 1)) {
      if ($msg.message -eq 0x0312 -and $msg.wParam.ToUInt32() -eq $id) {
        Release-AllInput
        Stop-Process -Id $parentPid -Force -ErrorAction SilentlyContinue
        exit 0
      }
    }
    if (-not (Get-Process -Id $parentPid -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 80
  }
} finally {
  [HotkeyWatchdogApi]::UnregisterHotKey([IntPtr]::Zero, $id) | Out-Null
}`;

const startWatchdog = (config: ServerConfig): ChildProcess | null => {
  const hotkey = parseHotkey(config.forceStopHotkey);
  return spawn('powershell.exe', [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    watchdogScript(process.pid, hotkey.modifiers, hotkey.key),
  ], { windowsHide: true, stdio: 'ignore' });
};

export const startForceStopHotkey = (config: ServerConfig): ForceStopHotkeyHandle | null => {
  if (process.platform !== 'win32' || config.disableForceStopHotkey) return null;
  try {
    const proc = startWatchdog(config);
    proc?.once('exit', (code) => {
      if (code === 23) logError(`Force-stop hotkey could not be registered: ${config.forceStopHotkey}`);
    });
    return proc ? { stop: () => proc.kill() } : null;
  } catch (error) {
    logError(error);
    return null;
  }
};
