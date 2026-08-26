import { runPowerShell, runPowerShellJson } from './processExec';
import { apiPrelude, escapePs } from './windowsApi';
import { toMonitor, toWindow } from './windowsValue';
import { foregroundWindowScript, listWindowHandlesScript, listWindowsScript } from './windowsWindowScripts';
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

export const listWindowsBrowserHandles = async (executablePath: string) => {
  if (process.platform !== 'win32') return [];
  const raw = await runPowerShellJson<string | string[]>(listWindowHandlesScript(executablePath), []);
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
};

export const getForegroundWindow = async () => {
  if (process.platform !== 'win32') return null;
  const raw = await runPowerShellJson<Record<string, unknown> | null>(foregroundWindowScript(), null);
  return raw ? toWindow(raw) : null;
};

export const getForegroundWindowHandle = async () => {
  if (process.platform !== 'win32') return '';
  return await runPowerShellJson<string>(`${apiPrelude()}
[NativeBrowserUseApi]::GetForegroundWindow().ToInt64().ToString() | ConvertTo-Json -Compress`, '');
};

export const bringWindowToTop = async (handle: string) => {
  if (process.platform !== 'win32' || !handle) return false;
  return await runPowerShellJson<boolean>(`${apiPrelude()}
$h = [IntPtr]::new([Int64]'${escapePs(handle)}')
[NativeBrowserUseApi]::BringToTop($h) | ConvertTo-Json -Compress`, false);
};

export const closeWindowByHandle = async (handle: string) => {
  if (process.platform !== 'win32' || !handle) return false;
  await runPowerShell(`${apiPrelude()}
$h = [IntPtr]::new([Int64]'${escapePs(handle)}')
[NativeBrowserUseApi]::PostMessage($h, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null`);
  return true;
};

export const captureWindowImage = async (params: { handle: string; left: number; top: number; width: number; height: number }) => {
  ensureWindows();
  return await runPowerShell(`${apiPrelude()}
Add-Type -AssemblyName System.Drawing
$h = [IntPtr]::new([Int64]'${escapePs(params.handle)}')
$width = ${Math.max(1, Math.round(params.width))}
$height = ${Math.max(1, Math.round(params.height))}
$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$dc = $graphics.GetHdc()
try {
  if (-not [NativeBrowserUseApi]::PrintWindow($h, $dc, 3)) { throw 'Handle-bound window capture failed.' }
  [NativeBrowserUseApi]::DrawVisibleCursor($dc, ${Math.round(params.left)}, ${Math.round(params.top)}, $width, $height) | Out-Null
} finally { $graphics.ReleaseHdc($dc) }
$stream = New-Object System.IO.MemoryStream
$bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $bitmap.Dispose()
[Convert]::ToBase64String($stream.ToArray())`);
};

export const listDisplays = async (): Promise<MonitorInfo[]> => {
  if (process.platform !== 'win32') return [];
  const raw = await runPowerShellJson<Record<string, unknown> | Record<string, unknown>[]>(`${apiPrelude()}
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::AllScreens | ForEach-Object {
  $point = New-Object POINT; $point.X = $_.Bounds.Left + [int]($_.Bounds.Width / 2); $point.Y = $_.Bounds.Top + [int]($_.Bounds.Height / 2)
  $monitor = [NativeBrowserUseApi]::MonitorFromPoint($point, 2); $scale = [NativeBrowserUseApi]::ReadMonitorScale($monitor)
  [PSCustomObject]@{handle=$monitor.ToInt64().ToString();id=$_.DeviceName;name=$_.DeviceName;isPrimary=$_.Primary;bounds=[PSCustomObject]@{left=$_.Bounds.Left;top=$_.Bounds.Top;right=$_.Bounds.Right;bottom=$_.Bounds.Bottom};workArea=[PSCustomObject]@{left=$_.WorkingArea.Left;top=$_.WorkingArea.Top;right=$_.WorkingArea.Right;bottom=$_.WorkingArea.Bottom};dpi=[math]::Round(96 * $scale / 100);scale=[math]::Round($scale / 100, 4)}
} | ConvertTo-Json -Depth 5 -Compress`, []);
  return (Array.isArray(raw) ? raw : [raw]).map(toMonitor).filter((entry): entry is MonitorInfo => !!entry);
};

const ownsDialog = (browser: WindowInfo, candidate: WindowInfo) =>
  candidate.className === '#32770' &&
  (
    candidate.ownerHandle === browser.handle ||
    candidate.rootOwnerHandle === browser.handle
  );

export const foregroundBrowserOwnedFileDialog = async (browser: WindowInfo) => {
  const handle = await getForegroundWindowHandle();
  if (!handle || handle === browser.handle) return null;
  const related = await runPowerShellJson<boolean>(`${apiPrelude()}
$browser = [IntPtr]::new([Int64]'${escapePs(browser.handle)}')
$candidate = [IntPtr]::new([Int64]'${escapePs(handle)}')
$classBuilder = New-Object System.Text.StringBuilder 256
[NativeBrowserUseApi]::GetClassName($candidate, $classBuilder, $classBuilder.Capacity) | Out-Null
($classBuilder.ToString() -eq '#32770' -and ([NativeBrowserUseApi]::GetWindow($candidate, 4) -eq $browser -or [NativeBrowserUseApi]::GetAncestor($candidate, 3) -eq $browser)) | ConvertTo-Json -Compress`, false);
  if (!related) return null;
  const foreground = await getForegroundWindow();
  if (!foreground || foreground.handle !== handle) return null;
  return ownsDialog(browser, foreground) ? foreground : null;
};

export const refreshWindow = async (window: WindowInfo) =>
  window.handle && window.processId > 0 && window.executablePath
    ? await findWindowsBrowserWindow({ handle: window.handle, pid: window.processId, executablePath: window.executablePath })
    : null;

export const pointBelongsToWindow = async (handle: string, point: { x: number; y: number }) => {
  if (process.platform !== 'win32' || !handle) return false;
  return await runPowerShellJson<boolean>(`${apiPrelude()}
$h = [IntPtr]::new([Int64]'${escapePs(handle)}')
[NativeBrowserUseApi]::OwnsPoint($h, ${Math.round(point.x)}, ${Math.round(point.y)}) | ConvertTo-Json -Compress`, false);
};
