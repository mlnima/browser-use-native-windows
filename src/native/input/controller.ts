import type { NativeInputMouseButton } from '../../types';
import { mouseSpeedMultiplier, mouseStepDelta, mouseTargetAttempts } from '../../defaults';
import { sleep } from '../../util/time';
import { logError } from '../../log';
import { createHumanMousePath } from './humanMousePath';
import { createWindowsInputAdapter, getWindowsInputDriverStatus } from './windowsAdapter';
import type { NativeInputController } from './types';

const randomNumberInRange = (minimum: number, maximum: number) =>
  minimum + Math.random() * (maximum - minimum);

const randomIntegerInRange = (minimum: number, maximum: number) =>
  Math.round(randomNumberInRange(minimum, maximum));

const humanKeyPauseMs = () =>
  randomIntegerInRange(18, 95);

const mouseButtons: NativeInputMouseButton[] = ['left', 'right', 'middle'];

const cursorAtTarget = (cursor: { x: number; y: number }, target: { x: number; y: number }) =>
  cursor.x === target.x && cursor.y === target.y;

const splitMouseStep = (dx: number, dy: number) => {
  const parts = Math.max(1, Math.ceil(Math.abs(dx) / mouseStepDelta), Math.ceil(Math.abs(dy) / mouseStepDelta));
  let movedDx = 0;
  let movedDy = 0;
  return Array.from({ length: parts }, (_, index) => {
    const targetDx = Math.round(dx * (index + 1) / parts);
    const targetDy = Math.round(dy * (index + 1) / parts);
    const step = { dx: targetDx - movedDx, dy: targetDy - movedDy };
    movedDx = targetDx;
    movedDy = targetDy;
    return step;
  }).filter((step) => step.dx !== 0 || step.dy !== 0);
};

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

  const moveMouseHuman = async (dx: number, dy: number) => {
    const steps = createHumanMousePath(dx, dy);
    let sentSteps = 0;
    for (const step of steps) {
      const splitSteps = splitMouseStep(step.dx, step.dy);
      for (const splitStep of splitSteps) {
        await adapter.moveMouseRelative(splitStep.dx, splitStep.dy);
        sentSteps += 1;
        await sleep(Math.max(1, Math.round(step.delayMs / splitSteps.length / mouseSpeedMultiplier)));
      }
    }
    return {
      steps: sentSteps,
      movedDx: steps.reduce((total, entry) => total + entry.dx, 0),
      movedDy: steps.reduce((total, entry) => total + entry.dy, 0),
    };
  };

  const moveMouseToTarget = async (x: number, y: number) => {
    const target = { x: Math.round(x), y: Math.round(y) };
    let totalSteps = 0;
    let totalDx = 0;
    let totalDy = 0;
    for (let attempt = 0; attempt < mouseTargetAttempts; attempt += 1) {
      const cursor = await readCursorPosition();
      const dx = target.x - cursor.x;
      const dy = target.y - cursor.y;
      if (cursorAtTarget(cursor, target)) return { steps: totalSteps, movedDx: totalDx, movedDy: totalDy };
      const result = attempt > 0 && Math.abs(dx) <= mouseStepDelta && Math.abs(dy) <= mouseStepDelta
        ? (await adapter.moveMouseRelative(dx, dy), { steps: 1, movedDx: dx, movedDy: dy })
        : await moveMouseHuman(dx, dy);
      totalSteps += result.steps;
      totalDx += result.movedDx;
      totalDy += result.movedDy;
      await sleep(Math.max(1, Math.round(12 / mouseSpeedMultiplier)));
    }
    const cursor = await readCursorPosition();
    if (!cursorAtTarget(cursor, target)) {
      logError(`Native cursor failed to reach target ${target.x},${target.y}; current position is ${cursor.x},${cursor.y}.`);
    }
    return { steps: totalSteps, movedDx: totalDx, movedDy: totalDy };
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
    clickMouse: async (button) => {
      try {
        await adapter.mouseDown(button);
        pressedButtons.add(button);
        await sleep(randomNumberInRange(20, 55));
      } finally {
        await releaseMouseButton(button);
      }
    },
    dragMouseTo: async (x, y, button) => {
      try {
        await adapter.mouseDown(button);
        pressedButtons.add(button);
        await sleep(randomNumberInRange(25, 70));
        const result = await moveMouseToTarget(x, y);
        await sleep(randomNumberInRange(10, 45));
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
      for (const character of text) {
        await sleep(randomIntegerInRange(12, 65));
        await adapter.typeText(character);
        await sleep(randomIntegerInRange(18, 110));
      }
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
