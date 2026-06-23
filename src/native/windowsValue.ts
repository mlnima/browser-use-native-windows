import type { Bounds, MonitorInfo, WindowInfo } from '../types';

export const numberValue = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

export const toBounds = (value: unknown): Bounds => {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    left: numberValue(root.left),
    top: numberValue(root.top),
    right: numberValue(root.right),
    bottom: numberValue(root.bottom),
  };
};

export const toMonitor = (value: unknown): MonitorInfo | undefined => {
  const root = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return root.id || root.handle
    ? {
        handle: String(root.handle || ''),
        id: String(root.id || ''),
        name: String(root.name || ''),
        isPrimary: root.isPrimary === true,
        bounds: toBounds(root.bounds),
        workArea: toBounds(root.workArea),
        dpi: numberValue(root.dpi) || undefined,
        scale: numberValue(root.scale) || undefined,
      }
    : undefined;
};

export const toWindow = (raw: Record<string, unknown>): WindowInfo => ({
  handle: String(raw.handle || ''),
  title: String(raw.title || ''),
  processId: numberValue(raw.processId),
  processName: String(raw.processName || ''),
  executablePath: String(raw.executablePath || ''),
  className: String(raw.className || ''),
  ownerHandle: String(raw.ownerHandle || ''),
  rootOwnerHandle: String(raw.rootOwnerHandle || ''),
  bounds: toBounds(raw.bounds),
  clientBounds: toBounds(raw.clientBounds),
  monitor: toMonitor(raw.monitor),
  dpi: numberValue(raw.dpi) || undefined,
});
