import type { NativeInputMouseButton } from '../../types';

export type NativeAction =
  | { kind: 'clickPoint'; x: number; y: number; doubleClick?: boolean; button?: NativeInputMouseButton; delayMs?: number }
  | { kind: 'modifierClickPoint'; x: number; y: number; modifiers: string[]; doubleClick?: boolean; button?: NativeInputMouseButton; delayMs?: number }
  | { kind: 'contextClickPoint'; x: number; y: number; delayMs?: number }
  | { kind: 'middleClickPoint'; x: number; y: number; delayMs?: number }
  | { kind: 'movePoint'; x: number; y: number }
  | { kind: 'dragPoint'; startX: number; startY: number; endX: number; endY: number; button?: NativeInputMouseButton }
  | { kind: 'typeText'; text: string; submit?: boolean; slowly?: boolean }
  | { kind: 'fileDialogUpload'; path: string }
  | { kind: 'press'; key: string; delayMs?: number }
  | { kind: 'pressCombo'; keys: string[]; delayMs?: number }
  | { kind: 'keyDown'; key: string }
  | { kind: 'keyUp'; key: string }
  | { kind: 'scroll'; x?: number; y?: number; delta?: number; deltaY?: number };
