import type { ChildProcess } from 'node:child_process';

export type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type Point = {
  x: number;
  y: number;
};

export type BrowserKind = 'brave' | 'canary' | 'chromium' | 'chrome' | 'custom' | 'edge';
export type TransportMode = 'stdio' | 'sse' | 'mcp';
export type ObservedTargetType = 'browser-window' | 'file-dialog';
export type TargetUrlStatus = 'not-provided' | 'matched' | 'navigated' | 'unknown';

export type BrowserExecutable = {
  kind: BrowserKind;
  path: string;
};

export type MonitorInfo = {
  handle?: string;
  id: string;
  name: string;
  isPrimary: boolean;
  bounds: Bounds;
  workArea?: Bounds;
  dpi?: number;
  scale?: number;
};

export type WindowInfo = {
  handle: string;
  title: string;
  processId: number;
  processName: string;
  executablePath: string;
  className?: string;
  ownerHandle?: string;
  rootOwnerHandle?: string;
  bounds: Bounds;
  clientBounds: Bounds;
  monitor?: MonitorInfo;
  dpi?: number;
};

export type RunningBrowser = {
  pid: number;
  exe: BrowserExecutable;
  userDataDir: string;
  startedAt: number;
  launchedByMcp: boolean;
  args: string[];
  proc?: ChildProcess;
};

export type AccessibilityNode = {
  id: string;
  role: string;
  name: string;
  automationId: string;
  className: string;
  bounds: Bounds;
  globalBounds: Bounds;
  center: Point;
  globalCenter: Point;
  checked: boolean | null;
};

export type ScreenshotMetadata = {
  contentType: 'image/png' | 'image/jpeg';
  byteLength: number;
  capturedAt: string;
  coordinateSpace: ObservedTargetType;
  globalCoordinateSpace: 'screen';
  origin: Point;
  globalBounds: Bounds;
  browserBounds: Bounds;
  browserClientBounds?: Bounds;
  fileDialogBounds?: Bounds;
  contentBounds?: Bounds;
  virtualBounds: Bounds;
  width: number;
  height: number;
  monitorIndex: number;
  monitor: MonitorInfo | null;
  dpi: number | null;
  monitors: Array<MonitorInfo & { index: number; intersectionArea: number }>;
};

export type Observation = {
  sessionId: string;
  observationToken: string;
  observedTargetType: ObservedTargetType;
  currentUrl: string | null;
  targetUrlStatus: TargetUrlStatus;
  screenshot: ScreenshotMetadata;
  screenshotPath: string;
  imageBase64?: string;
  accessibilityNodes: AccessibilityNode[];
  browser: WindowInfo;
  target: WindowInfo;
  capturedAt: string;
  consumed: boolean;
  stale: boolean;
};

export type NativeInputMouseButton = 'left' | 'right' | 'middle';
