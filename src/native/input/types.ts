import type { Bounds, NativeInputMouseButton, Point } from '../../types';

export type NativeInputAdapter = {
  platform: 'windows';
  moveMouseRelative: (dx: number, dy: number) => Promise<void>;
  moveMouseAbsolute: (x: number, y: number, desktopBounds: Bounds) => Promise<void>;
  mouseDown: (button: NativeInputMouseButton) => Promise<void>;
  mouseUp: (button: NativeInputMouseButton) => Promise<void>;
  scroll: (delta: number) => Promise<void>;
  keyDown: (key: string) => Promise<void>;
  keyUp: (key: string) => Promise<void>;
  pressKey: (key: string) => Promise<void>;
  pressKeyCombo: (keys: string[]) => Promise<void>;
  typeText: (text: string) => Promise<void>;
  getCursorPosition: () => Promise<Point | null>;
};

export type NativeInputController = NativeInputAdapter & {
  scrollMouse: (delta: number) => Promise<void>;
  moveMouseTo: (x: number, y: number, desktopBounds: Bounds) => Promise<{ steps: number; movedDx: number; movedDy: number }>;
  clickMouse: (button: NativeInputMouseButton) => Promise<void>;
  dragMouseTo: (x: number, y: number, desktopBounds: Bounds, button: NativeInputMouseButton) => Promise<{ steps: number; movedDx: number; movedDy: number }>;
  releaseAll: () => Promise<void>;
  driverStatus: () => Promise<{ available: boolean; error: string | null }>;
};
