import type { Bounds, NativeInputMouseButton } from '../../types';
import { mouseSpeedMultiplier, mouseTargetAttempts } from '../../defaults';
import { sleep } from '../../util/time';
import { logError } from '../../log';
import { createWindowsInputAdapter, getWindowsInputDriverStatus } from './windowsAdapter';
import type { NativeInputController } from './types';

const randomNumberInRange = (minimum: number, maximum: number) =>
  minimum + Math.random() * (maximum - minimum);

const randomIntegerInRange = (minimum: number, maximum: number) =>
  Math.round(randomNumberInRange(minimum, maximum));

const humanKeyPauseMs = () =>
  randomIntegerInRange(8, 25);

const mouseButtons: NativeInputMouseButton[] = ['left', 'right', 'middle'];

const cursorAtTarget = (cursor: { x: number; y: number }, target: { x: number; y: number }) =>
  cursor.x === target.x && cursor.y === target.y;

let controller: NativeInputController | null = null;

export const getNativeInputController = () => {
  if (controller) return controller;
  const adapter = createWindowsInputAdapter();
  const pressedButtons = new Set<NativeInputMouseButton>();
  const pressedKeys = new Set<string>();

  const releaseMouseButton = async (button: NativeInputMouseButton) => {
    if (!pressedButtons.has(button)) return;
    try {
      await adapter.mouseUp(button);
    } finally {
      pressedButtons.delete(button);
    }
  };

  const releaseMouseButtons = async () => {
    const errors: string[] = [];
    for (const button of mouseButtons) {
      try {
        await releaseMouseButton(button);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (errors.length > 0) throw new Error(`Native mouse release failed: ${errors.join('; ')}`);
  };

  const releaseKey = async (key: string) => {
    if (!pressedKeys.has(key)) return;
    try {
      await adapter.keyUp(key);
    } finally {
      pressedKeys.delete(key);
    }
  };

  const releaseKeys = async () => {
    const errors: string[] = [];
    for (const key of Array.from(pressedKeys).reverse()) {
      try {
        await releaseKey(key);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
    if (errors.length > 0) throw new Error(`Native key release failed: ${errors.join('; ')}`);
  };

  const readCursorPosition = async () => {
    const cursor = await adapter.getCursorPosition();
    if (!cursor) throw new Error('Native cursor position is not available.');
    return cursor;
  };

  const moveMouseToTarget = async (x: number, y: number, desktopBounds: Bounds) => {
    const target = { x: Math.round(x), y: Math.round(y) };
    if (target.x < desktopBounds.left || target.x >= desktopBounds.right || target.y < desktopBounds.top || target.y >= desktopBounds.bottom) {
      throw new Error('Native cursor target is outside the current virtual desktop.');
    }
    const initial = await readCursorPosition();
    let totalSteps = 0;
    for (let attempt = 0; attempt < mouseTargetAttempts; attempt += 1) {
      const cursor = await readCursorPosition();
      if (cursorAtTarget(cursor, target)) return { steps: totalSteps, movedDx: target.x - initial.x, movedDy: target.y - initial.y };
      await adapter.moveMouseAbsolute(target.x, target.y, desktopBounds);
      totalSteps += 1;
      await sleep(Math.max(1, Math.round(12 / mouseSpeedMultiplier)));
    }
    const cursor = await readCursorPosition();
    const message = `Native cursor failed to reach target ${target.x},${target.y}; current position is ${cursor.x},${cursor.y}.`;
    logError(message);
    throw new Error(message);
  };

  controller = {
    ...adapter,
    scrollMouse: async (delta) => {
      await releaseMouseButtons();
      await adapter.scroll(delta);
    },
    moveMouseTo: async (x, y, desktopBounds) => {
      await releaseMouseButtons();
      return await moveMouseToTarget(x, y, desktopBounds);
    },
    clickMouse: async (button) => {
      try {
        await adapter.mouseDown(button);
        pressedButtons.add(button);
        await sleep(randomNumberInRange(12, 28));
      } finally {
        await releaseMouseButton(button);
      }
    },
    dragMouseTo: async (x, y, desktopBounds, button) => {
      try {
        await adapter.mouseDown(button);
        pressedButtons.add(button);
        await sleep(randomNumberInRange(15, 35));
        const result = await moveMouseToTarget(x, y, desktopBounds);
        await sleep(randomNumberInRange(8, 20));
        return result;
      } finally {
        await releaseMouseButton(button);
      }
    },
    pressKey: async (key) => {
      await sleep(humanKeyPauseMs());
      await adapter.pressKey(key);
      await sleep(humanKeyPauseMs());
    },
    pressKeyCombo: async (keys) => {
      await sleep(humanKeyPauseMs());
      await adapter.pressKeyCombo(keys);
      await sleep(humanKeyPauseMs());
    },
    typeText: async (text) => {
      await sleep(randomIntegerInRange(8, 25));
      await adapter.typeText(text);
      await sleep(randomIntegerInRange(8, 30));
    },
    mouseDown: async (button) => {
      await adapter.mouseDown(button);
      pressedButtons.add(button);
    },
    mouseUp: releaseMouseButton,
    keyDown: async (key) => {
      await adapter.keyDown(key);
      pressedKeys.add(key);
    },
    keyUp: releaseKey,
    releaseAll: async () => {
      await releaseMouseButtons();
      await releaseKeys();
    },
    driverStatus: getWindowsInputDriverStatus,
  };
  return controller;
};
