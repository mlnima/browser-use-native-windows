import { runPowerShellJson } from './processExec';
import { apiPrelude, escapePs } from './windowsApi';
import type { WindowInfo } from '../types';

const looksLikeUrl = (value: string) =>
  /^(https?|file|about):/i.test(value) || /^[\w-]+\.[\w.-]+/.test(value);

const withProtocol = (value: string, protocol = 'https:') =>
  /^[a-z][a-z\d+.-]*:/i.test(value) ? value : `${protocol}//${value}`;

const script = (window: WindowInfo) => `
${apiPrelude()}
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$h = [IntPtr]::new([Int64]'${escapePs(window.handle)}')
$root = [System.Windows.Automation.AutomationElement]::FromHandle($h)
$items = New-Object System.Collections.Generic.List[string]
if ($root -ne $null) {
  $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
  $elements = $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, $condition)
  for ($index = 0; $index -lt $elements.Count; $index++) {
    try {
      $element = $elements.Item($index)
      $current = $element.Current
      if ($current.IsOffscreen) { continue }
      $pattern = $null
      if ($element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) {
        $value = [string]$pattern.Current.Value
        if ($value.Length -gt 0) { $items.Add($value) | Out-Null }
      }
    } catch {}
  }
}
@($items.ToArray()) | ConvertTo-Json -Compress`;

const normalizeForCompare = (value: string) => {
  try {
    const url = new URL(withProtocol(value));
    const path = url.pathname.endsWith('/') && url.pathname.length > 1
      ? url.pathname.slice(0, -1)
      : url.pathname;
    const host = `${url.hostname.replace(/^www\./i, '')}${url.port ? `:${url.port}` : ''}`;
    return `${url.protocol}//${host}${path}${url.search}${url.hash}`.toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, '').toLowerCase();
  }
};

export const readCurrentBrowserUrl = async (window: WindowInfo) => {
  if (process.platform !== 'win32' || !window.handle) return null;
  try {
    const raw = await runPowerShellJson<string | string[]>(script(window), [], 2000);
    const values = Array.isArray(raw) ? raw : [raw];
    return values.map((entry) => String(entry || '').trim()).find(looksLikeUrl) || null;
  } catch {
    return null;
  }
};

export const urlsMatch = (a: string, b: string) =>
  normalizeForCompare(a) === normalizeForCompare(b);

export const urlReached = (current: string, requested: string) => {
  if (urlsMatch(current, requested)) return true;
  try {
    const requestedUrl = new URL(requested);
    const currentUrl = new URL(withProtocol(current, requestedUrl.protocol));
    return normalizeForCompare(currentUrl.href) === normalizeForCompare(requestedUrl.href) ||
      requestedUrl.pathname === '/' && currentUrl.origin.toLowerCase() === requestedUrl.origin.toLowerCase();
  } catch {
    return false;
  }
};
