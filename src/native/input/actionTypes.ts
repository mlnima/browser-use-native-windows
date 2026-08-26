import type { NativeInputMouseButton, Point } from '../../types';

export type NativeAction =
  | { kind: 'moveNode'; nodeId: string }
  | { kind: 'movePoint'; x: number; y: number }
  | { kind: 'clickCurrentPointer'; pointerVerificationToken: string; modifiers?: string[]; button?: NativeInputMouseButton; delayMs?: number }
  | { kind: 'dragFromCurrentPointer'; pointerVerificationToken: string; endX: number; endY: number; button?: NativeInputMouseButton }
  | { kind: 'typeText'; text: string; submit?: boolean; slowly?: boolean }
  | { kind: 'fileDialogUpload'; path: string }
  | { kind: 'press'; key: string; delayMs?: number }
  | { kind: 'pressCombo'; keys: string[]; delayMs?: number }
  | { kind: 'keyDown'; key: string }
  | { kind: 'keyUp'; key: string }
  | { kind: 'scrollCurrentPointer'; pointerVerificationToken: string; direction: 'up' | 'down'; steps?: number };

export type PointerMoveResult = {
  kind: 'pointerMoved';
  cursorVerified: true;
  target: {
    globalPoint: Point;
    localPoint: Point;
    nodeId?: string;
    nodeName?: string;
  };
};

export type PointerVerification = PointerMoveResult['target'] & {
  token: string;
  observationToken: string;
  targetHandle: string;
};

export const actionNeedsPointerVerification = (action: NativeAction) =>
  action.kind === 'clickCurrentPointer' ||
  action.kind === 'dragFromCurrentPointer' ||
  action.kind === 'scrollCurrentPointer';

export const actionMayLoadPage = (action: NativeAction) =>
  action.kind === 'clickCurrentPointer' ||
  action.kind === 'press' ||
  action.kind === 'pressCombo' ||
  (action.kind === 'typeText' && action.submit === true);
