import path from 'node:path';
import { apiPrelude, boundsObject, escapePs } from './windowsApi';

export const listWindowsScript = (params: { handle?: string; pid?: number; executablePath?: string }) => `
${apiPrelude()}
$targetHandle = '${escapePs(params.handle || '')}'
$targetPid = ${params.pid && params.pid > 0 ? String(params.pid) : '0'}
$targetPath = '${escapePs(params.executablePath ? path.win32.normalize(params.executablePath) : '')}'
$targetName = if ($targetPath.Length -gt 0) { [System.IO.Path]::GetFileNameWithoutExtension($targetPath).ToLowerInvariant() } else { "" }
$items = New-Object System.Collections.Generic.List[object]
[NativeBrowserUseApi]::EnumWindows({
  param($handle, $lParam)
  if (-not [NativeBrowserUseApi]::IsWindowVisible($handle)) { return $true }
  if ([NativeBrowserUseApi]::GetAncestor($handle, 2) -ne $handle) { return $true }
  if ([NativeBrowserUseApi]::GetWindow($handle, 4) -ne [IntPtr]::Zero) { return $true }
  if ([NativeBrowserUseApi]::IsToolWindow($handle)) { return $true }
  $windowPid = [uint32]0
  [NativeBrowserUseApi]::GetWindowThreadProcessId($handle, [ref]$windowPid) | Out-Null
  $process = Get-Process -Id $windowPid -ErrorAction SilentlyContinue
  if (-not $process) { return $true }
  $processPath = ""; try { $processPath = [string]$process.Path } catch {}
  $handleString = $handle.ToInt64().ToString()
  $handleMatch = $targetHandle.Length -gt 0 -and $handleString -eq $targetHandle
  $pidMatch = $targetPid -gt 0 -and [int]$windowPid -eq $targetPid
  $nameMatch = $targetName.Length -gt 0 -and $process.ProcessName.ToLowerInvariant() -eq $targetName
  $pathMatch = $targetPath.Length -gt 0 -and $processPath.Length -gt 0 -and [System.IO.Path]::GetFullPath($processPath).ToLowerInvariant() -eq [System.IO.Path]::GetFullPath($targetPath).ToLowerInvariant()
  $targetMatch = if ($targetHandle.Length -gt 0) { $handleMatch -and ($targetName.Length -eq 0 -or $pathMatch -or $nameMatch) } elseif ($targetPid -gt 0) { $pidMatch } elseif ($targetPath.Length -gt 0) { $pathMatch -or $nameMatch } else { $false }
  if (-not $targetMatch) { return $true }
  $frame = [NativeBrowserUseApi]::ReadFrameRect($handle)
  if (($frame.Right - $frame.Left -lt 120) -or ($frame.Bottom - $frame.Top -lt 120)) { return $true }
  $client = [NativeBrowserUseApi]::ReadClientRect($handle)
  $monitorHandle = [NativeBrowserUseApi]::MonitorFromWindow($handle, 2)
  $monitor = [NativeBrowserUseApi]::ReadMonitorInfo($monitorHandle)
  $length = [NativeBrowserUseApi]::GetWindowTextLength($handle)
  $builder = New-Object System.Text.StringBuilder ($length + 1)
  [NativeBrowserUseApi]::GetWindowText($handle, $builder, $builder.Capacity) | Out-Null
  $classBuilder = New-Object System.Text.StringBuilder 256
  [NativeBrowserUseApi]::GetClassName($handle, $classBuilder, $classBuilder.Capacity) | Out-Null
  $area = [double](($frame.Right - $frame.Left) * ($frame.Bottom - $frame.Top))
  $score = $area + $(if ($handleMatch) { 10000000000000 } else { 0 }) + $(if ($pidMatch) { 1000000000000 } else { 0 }) + $(if ($pathMatch) { 100000000000 } else { 0 })
  $dpi = [int][NativeBrowserUseApi]::ReadDpi($handle)
  $owner = [NativeBrowserUseApi]::GetWindow($handle, 4)
  $rootOwner = [NativeBrowserUseApi]::GetAncestor($handle, 3)
  $items.Add([PSCustomObject]@{
    handle=$handleString; title=$builder.ToString(); className=$classBuilder.ToString(); ownerHandle=$owner.ToInt64().ToString(); rootOwnerHandle=$rootOwner.ToInt64().ToString();
    processId=[int]$windowPid; processName=$process.ProcessName; executablePath=$processPath; bounds=${boundsObject('frame')}; clientBounds=${boundsObject('client')}; dpi=$dpi; score=$score;
    monitor=[PSCustomObject]@{handle=$monitorHandle.ToInt64().ToString();id=$monitor.szDevice;name=$monitor.szDevice;isPrimary=($monitor.dwFlags -band 1) -eq 1;bounds=${boundsObject('monitor.rcMonitor')};workArea=${boundsObject('monitor.rcWork')};dpi=$dpi;scale=[math]::Round($dpi / 96, 4)}
  }) | Out-Null
  return $true
}, [IntPtr]::Zero) | Out-Null
$items | Sort-Object score -Descending | ConvertTo-Json -Depth 8 -Compress`;

export const foregroundWindowScript = () => `
${apiPrelude()}
$handle = [NativeBrowserUseApi]::GetForegroundWindow()
if ($handle -eq [IntPtr]::Zero) { return }
$windowPid = [uint32]0
[NativeBrowserUseApi]::GetWindowThreadProcessId($handle, [ref]$windowPid) | Out-Null
$process = Get-Process -Id $windowPid -ErrorAction SilentlyContinue
if (-not $process) { return }
$frame = [NativeBrowserUseApi]::ReadFrameRect($handle)
$client = [NativeBrowserUseApi]::ReadClientRect($handle)
$monitorHandle = [NativeBrowserUseApi]::MonitorFromWindow($handle, 2)
$monitor = [NativeBrowserUseApi]::ReadMonitorInfo($monitorHandle)
$length = [NativeBrowserUseApi]::GetWindowTextLength($handle)
$builder = New-Object System.Text.StringBuilder ($length + 1)
[NativeBrowserUseApi]::GetWindowText($handle, $builder, $builder.Capacity) | Out-Null
$classBuilder = New-Object System.Text.StringBuilder 256
[NativeBrowserUseApi]::GetClassName($handle, $classBuilder, $classBuilder.Capacity) | Out-Null
$processPath = ""; try { $processPath = [string]$process.Path } catch {}
$owner = [NativeBrowserUseApi]::GetWindow($handle, 4)
$rootOwner = [NativeBrowserUseApi]::GetAncestor($handle, 3)
$dpi = [int][NativeBrowserUseApi]::ReadDpi($handle)
[PSCustomObject]@{
  handle=$handle.ToInt64().ToString(); title=$builder.ToString(); className=$classBuilder.ToString(); ownerHandle=$owner.ToInt64().ToString(); rootOwnerHandle=$rootOwner.ToInt64().ToString();
  processId=[int]$windowPid; processName=$process.ProcessName; executablePath=$processPath; bounds=${boundsObject('frame')}; clientBounds=${boundsObject('client')}; dpi=$dpi;
  monitor=[PSCustomObject]@{handle=$monitorHandle.ToInt64().ToString();id=$monitor.szDevice;name=$monitor.szDevice;isPrimary=($monitor.dwFlags -band 1) -eq 1;bounds=${boundsObject('monitor.rcMonitor')};workArea=${boundsObject('monitor.rcWork')};dpi=$dpi;scale=[math]::Round($dpi / 96, 4)}
} | ConvertTo-Json -Depth 8 -Compress`;
