import { runPowerShell, runPowerShellJson } from './processExec';
import { apiPrelude, escapePs } from './windowsApi';
import { toMonitor, toWindow } from './windowsValue';
import { foregroundWindowScript, listWindowsScript } from './windowsWindowScripts';
import type { Bounds, MonitorInfo, WindowInfo } from '../types';

const ensureWindows = () => {
  if (process.platform !== 'win32') throw new Error('browser-use-native-windows only supports Windows.');
};

const rawList = async (script: string) => {
  const raw = await runPowerShellJson<Record<string, unknown> | Record<string, unknown>[]>(script, []);
  return Array.isArray(raw) ? raw : [raw];
};

export const listWindowsBrowserWindows = async (params: { handle?: string; pid?: number; executablePath?: string }) => {
  if (process.platform !== 'win32') return [];
  return (await rawList(listWindowsScript(params))).map(toWindow);
};

export const findWindowsBrowserWindow = async (params: { handle?: string; pid?: number; executablePath?: string }) =>
  (await listWindowsBrowserWindows(params))[0] || null;

export const getForegroundWindow = async () => {
  if (process.platform !== 'win32') return null;
  const raw = await runPowerShellJson<Record<string, unknown> | null>(foregroundWindowScript(), null);
  return raw ? toWindow(raw) : null;
};

export const bringWindowToTop = async (handle: string) => {
  if (process.platform !== 'win32' || !handle) return;
  await runPowerShell(`${apiPrelude()}
$h = [IntPtr]::new([Int64]'${escapePs(handle)}')
[NativeBrowserUseApi]::BringToTop($h)`);
};

export const closeWindowByHandle = async (handle: string) => {
  if (process.platform !== 'win32' || !handle) return false;
  await runPowerShell(`${apiPrelude()}
$h = [IntPtr]::new([Int64]'${escapePs(handle)}')
[NativeBrowserUseApi]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null`);
  return true;
};

export const captureWindowImage = async (bounds: Bounds) => {
  ensureWindows();
  return await runPowerShell(`${apiPrelude()}
Add-Type -AssemblyName System.Drawing
$left = ${Math.round(bounds.left)}; $top = ${Math.round(bounds.top)}
$width = ${Math.max(1, Math.round(bounds.right - bounds.left))}
$height = ${Math.max(1, Math.round(bounds.bottom - bounds.top))}
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($left, $top, 0, 0, $bitmap.Size)
$stream = New-Object System.IO.MemoryStream
$bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose()
[Convert]::ToBase64String($stream.ToArray())`);
};

export const listDisplays = async (): Promise<MonitorInfo[]> => {
  if (process.platform !== 'win32') return [];
  const raw = await runPowerShellJson<Record<string, unknown> | Record<string, unknown>[]>(`${apiPrelude()}
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::AllScreens | Select-Object @{Name='handle';Expression={$_.DeviceName}}, @{Name='id';Expression={$_.DeviceName}}, @{Name='name';Expression={$_.DeviceName}}, @{Name='isPrimary';Expression={$_.Primary}}, @{Name='bounds';Expression={[PSCustomObject]@{left=$_.Bounds.Left;top=$_.Bounds.Top;right=$_.Bounds.Right;bottom=$_.Bounds.Bottom}}}, @{Name='workArea';Expression={[PSCustomObject]@{left=$_.WorkingArea.Left;top=$_.WorkingArea.Top;right=$_.WorkingArea.Right;bottom=$_.WorkingArea.Bottom}}} | ConvertTo-Json -Depth 5 -Compress`, []);
  return (Array.isArray(raw) ? raw : [raw]).map(toMonitor).filter((entry): entry is MonitorInfo => !!entry);
};

const sameProcessFamily = (browser: WindowInfo, candidate: WindowInfo) =>
  browser.processId > 0 &&
  candidate.processId === browser.processId &&
  candidate.processName.toLowerCase() === browser.processName.toLowerCase();

const ownsDialog = (browser: WindowInfo, candidate: WindowInfo) =>
  candidate.className === '#32770' &&
  (
    candidate.ownerHandle === browser.handle ||
    candidate.rootOwnerHandle === browser.handle ||
    sameProcessFamily(browser, candidate)
  );

export const foregroundBrowserOwnedFileDialog = async (browser: WindowInfo) => {
  const foreground = await getForegroundWindow();
  if (!foreground || foreground.handle === browser.handle) return null;
  return ownsDialog(browser, foreground) ? foreground : null;
};

export const refreshWindow = async (window: WindowInfo, executablePath?: string) =>
  window.handle ? await findWindowsBrowserWindow({ handle: window.handle, executablePath }) : null;
