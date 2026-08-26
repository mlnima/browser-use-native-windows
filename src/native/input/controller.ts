import type { NativeInputMouseButton } from '../../types';
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

  const moveMouseToTarget = async (x: number, y: number) => {
    const target = { x: Math.round(x), y: Math.round(y) };
    const movement = await adapter.moveMouseTo(target.x, target.y);
    if (movement.end.x === target.x && movement.end.y === target.y) return movement;
    const message = `Native cursor failed to reach target ${target.x},${target.y}; current position is ${movement.end.x},${movement.end.y}.`;
    logError(message);
    throw new Error(message);
  };

  controller = {
    ...adapter,
    scrollMouse: async (delta) => {
      await releaseMouseButtons();
      await adapter.scroll(delta);
    },
    moveMouseTo: async (x, y) => {
      await releaseMouseButtons();
      return await moveMouseToTarget(x, y);
    },
    clickMouse: async (button, point) => {
      await releaseMouseButtons();
      await adapter.clickMouseAt(button, point, randomNumberInRange(12, 28));
    },
    dragMouseTo: async (x, y, button) => {
      try {
        await adapter.mouseDown(button);
        pressedButtons.add(button);
        await sleep(randomNumberInRange(15, 35));
        const result = await moveMouseToTarget(x, y);
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
