import type { NativeInputMouseButton } from '../../types';

export type NativeAction =
  | { kind: 'clickNode'; nodeId: string; modifiers?: string[]; doubleClick?: boolean; button?: NativeInputMouseButton; delayMs?: number }
  | { kind: 'clickPoint'; x: number; y: number; doubleClick?: boolean; button?: NativeInputMouseButton; delayMs?: number }
  | { kind: 'modifierClickPoint'; x: number; y: number; modifiers: string[]; doubleClick?: boolean; button?: NativeInputMouseButton; delayMs?: number }
  | { kind: 'contextClickPoint'; x: number; y: number; delayMs?: number }
  | { kind: 'middleClickPoint'; x: number; y: number; delayMs?: number }
  | { kind: 'movePoint'; x: number; y: number }
  | { kind: 'dragPoint'; startX: number; startY: number; endX: number; endY: number; button?: NativeInputMouseButton }
  | { kind: 'typeText'; text: string; submit?: boolean; slowly?: boolean }
  | { kind: 'fileDialogUpload'; path: string; x?: number; y?: number }
  | { kind: 'press'; key: string; delayMs?: number }
  | { kind: 'pressCombo'; keys: string[]; delayMs?: number }
  | { kind: 'keyDown'; key: string }
  | { kind: 'keyUp'; key: string }
  | { kind: 'scroll'; x: number; y: number; direction: 'up' | 'down'; steps?: number };

export const actionMayLoadPage = (action: NativeAction) =>
  action.kind === 'clickNode' ||
  action.kind === 'clickPoint' ||
  action.kind === 'modifierClickPoint' ||
  action.kind === 'middleClickPoint' ||
  action.kind === 'press' ||
  action.kind === 'pressCombo' ||
  (action.kind === 'typeText' && action.submit === true);
