import type { NativeInputMouseButton, Point } from '../../types';

export type NativeMouseMovement = {
  steps: number;
  start: Point;
  end: Point;
};

export type NativeInputAdapter = {
  platform: 'windows';
  moveMouseTo: (x: number, y: number) => Promise<NativeMouseMovement>;
  clickMouseAt: (button: NativeInputMouseButton, point: Point, holdMs: number) => Promise<void>;
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
  moveMouseTo: (x: number, y: number) => Promise<NativeMouseMovement>;
  clickMouse: (button: NativeInputMouseButton, point: Point) => Promise<void>;
  dragMouseTo: (x: number, y: number, button: NativeInputMouseButton) => Promise<NativeMouseMovement>;
  releaseAll: () => Promise<void>;
  driverStatus: () => Promise<{ available: boolean; error: string | null }>;
};
