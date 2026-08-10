import { accessibilityMaxNodes, accessibilityReadTimeoutMs } from '../defaults';
import type { AccessibilityNode, Bounds, Point, WindowInfo } from '../types';
import { runPowerShellJson } from './processExec';
import { boundsHeight, boundsWidth } from './geometry';
import { apiPrelude, escapePs } from './windowsApi';

type RawAccessibilityNode = Record<string, unknown>;
const roleOrder: Record<string, number> = { CheckBox: 1, RadioButton: 2, Edit: 3, ComboBox: 4, Button: 5, Slider: 6, Spinner: 7, Hyperlink: 8, MenuItem: 9, ListItem: 10 };
const numberValue = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
const toBounds = (value: unknown): Bounds => {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { left: numberValue(root.left), top: numberValue(root.top), right: numberValue(root.right), bottom: numberValue(root.bottom) };
};
const toPoint = (value: unknown): Point => {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { x: numberValue(root.x), y: numberValue(root.y) };
};
const toNode = (raw: RawAccessibilityNode): AccessibilityNode => ({
  id: String(raw.id || ''), role: String(raw.role || ''), name: String(raw.name || ''),
  automationId: String(raw.automationId || ''), className: String(raw.className || ''),
  bounds: toBounds(raw.bounds), globalBounds: toBounds(raw.globalBounds),
  center: toPoint(raw.center), globalCenter: toPoint(raw.globalCenter),
  checked: raw.checked === true || raw.checked === false ? raw.checked : null,
});
const compareNode = (a: AccessibilityNode, b: AccessibilityNode) =>
  (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99) ||
  a.globalBounds.top - b.globalBounds.top || a.globalBounds.left - b.globalBounds.left;
const scaleBounds = (bounds: Bounds, from: Bounds, width: number, height: number): Bounds => ({
  left: Math.round(bounds.left / Math.max(1, boundsWidth(from)) * width),
  top: Math.round(bounds.top / Math.max(1, boundsHeight(from)) * height),
  right: Math.round(bounds.right / Math.max(1, boundsWidth(from)) * width),
  bottom: Math.round(bounds.bottom / Math.max(1, boundsHeight(from)) * height),
});
const scalePoint = (point: Point, from: Bounds, width: number, height: number): Point => ({
  x: Math.round(point.x / Math.max(1, boundsWidth(from)) * width),
  y: Math.round(point.y / Math.max(1, boundsHeight(from)) * height),
});
const script = (window: WindowInfo, capture: Bounds) => `
${apiPrelude()}
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [Console]::OutputEncoding
Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; Add-Type -AssemblyName WindowsBase
$h = [IntPtr]::new([Int64]'${escapePs(window.handle)}')
$left = ${Math.round(capture.left)}; $top = ${Math.round(capture.top)}; $right = ${Math.round(capture.right)}; $bottom = ${Math.round(capture.bottom)}
  $roles = @("CheckBox","RadioButton","Edit","ComboBox","Button","Slider","Spinner","Hyperlink","MenuItem","ListItem")
  $controlTypes = @([System.Windows.Automation.ControlType]::CheckBox,[System.Windows.Automation.ControlType]::RadioButton,[System.Windows.Automation.ControlType]::Edit,[System.Windows.Automation.ControlType]::ComboBox,[System.Windows.Automation.ControlType]::Button,[System.Windows.Automation.ControlType]::Slider,[System.Windows.Automation.ControlType]::Spinner,[System.Windows.Automation.ControlType]::Hyperlink,[System.Windows.Automation.ControlType]::MenuItem,[System.Windows.Automation.ControlType]::ListItem)
$maxNodes = ${accessibilityMaxNodes}
  $root = [System.Windows.Automation.AutomationElement]::FromHandle($h); $items = New-Object System.Collections.Generic.List[object]
  if ($root -ne $null) {
    foreach ($controlType in $controlTypes) {
      if ($items.Count -ge $maxNodes) { break }
      $condition = [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, $controlType)
      $elements = $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, $condition)
      for ($index = 0; $index -lt $elements.Count -and $items.Count -lt $maxNodes; $index++) {
    try {
      $element = $elements.Item($index); $current = $element.Current
      if ($current.IsOffscreen) { continue }
      $role = $current.ControlType.ProgrammaticName.Replace("ControlType.", "")
      if (-not $roles.Contains($role)) { continue }
      $rect = $current.BoundingRectangle
      if ($rect.IsEmpty -or $rect.Width -lt 1 -or $rect.Height -lt 1) { continue }
      $clipLeft = [Math]::Max($rect.Left, $left); $clipTop = [Math]::Max($rect.Top, $top)
      $clipRight = [Math]::Min($rect.Right, $right); $clipBottom = [Math]::Min($rect.Bottom, $bottom)
      if (($clipRight - $clipLeft -lt 1) -or ($clipBottom - $clipTop -lt 1)) { continue }
      $cx = [int][Math]::Round(($clipLeft + $clipRight) / 2); $cy = [int][Math]::Round(($clipTop + $clipBottom) / 2)
      try {
        $clickable = $element.GetClickablePoint()
        if ($clickable.X -ge $clipLeft -and $clickable.X -lt $clipRight -and $clickable.Y -ge $clipTop -and $clickable.Y -lt $clipBottom) {
          $cx = [int][Math]::Round($clickable.X); $cy = [int][Math]::Round($clickable.Y)
        }
      } catch {}
      $toggle = $null; $checked = $null
      if ($element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$toggle)) {
        $state = $toggle.Current.ToggleState.ToString(); if ($state -eq "On") { $checked = $true }; if ($state -eq "Off") { $checked = $false }
      }
      $items.Add([PSCustomObject]@{
        id=("uia-" + ($items.Count + 1));role=$role;name=[string]$current.Name;automationId=[string]$current.AutomationId;className=[string]$current.ClassName;checked=$checked;
        bounds=[PSCustomObject]@{left=[int][Math]::Round($clipLeft-$left);top=[int][Math]::Round($clipTop-$top);right=[int][Math]::Round($clipRight-$left);bottom=[int][Math]::Round($clipBottom-$top)};
        globalBounds=[PSCustomObject]@{left=[int][Math]::Round($clipLeft);top=[int][Math]::Round($clipTop);right=[int][Math]::Round($clipRight);bottom=[int][Math]::Round($clipBottom)};
        center=[PSCustomObject]@{x=[int]($cx-$left);y=[int]($cy-$top)};globalCenter=[PSCustomObject]@{x=$cx;y=$cy}
      }) | Out-Null
      } catch {}
    }
  }
}
@($items.ToArray()) | ConvertTo-Json -Depth 8 -Compress`;

export const listAccessibilityNodes = async (window: WindowInfo, capture: Bounds, size: { width: number; height: number }) => {
  if (process.platform !== 'win32' || !window.handle) return [];
  try {
    const raw = await runPowerShellJson<RawAccessibilityNode | RawAccessibilityNode[]>(script(window, capture), [], accessibilityReadTimeoutMs);
    const nodes = (Array.isArray(raw) ? raw : [raw]).filter((entry): entry is RawAccessibilityNode => !!entry && typeof entry === 'object')
      .map(toNode).sort(compareNode).slice(0, accessibilityMaxNodes);
    return nodes.map((node) => ({ ...node, bounds: scaleBounds(node.bounds, capture, size.width, size.height), center: scalePoint(node.center, capture, size.width, size.height) }));
  } catch {
    return [];
  }
};
