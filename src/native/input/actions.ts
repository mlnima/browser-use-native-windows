import type { NativeInputMouseButton, Observation, Point } from '../../types';
import { clickDelayMs, doubleClickDelayMs, scrollDefault, scrollMax, scrollMin } from '../../defaults';
import { boundsHeight, boundsWidth, localToGlobalPoint, pointInsideBounds } from '../geometry';
import { bringWindowToTop } from '../windowsWindow';
import { sleep } from '../../util/time';
import { logError } from '../../log';
import { getNativeInputController } from './controller';
import type { NativeAction } from './actionTypes';
import type { NativeInputController } from './types';

const clampNumber = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const normalizeKey = (key: string) =>
  key === 'Return'
    ? 'Enter'
    : key.startsWith('Arrow')
      ? key.slice('Arrow'.length)
      : key;

const normalizeButton = (button?: NativeInputMouseButton): NativeInputMouseButton =>
  button === 'right' || button === 'middle' ? button : 'left';

const localPoint = (observation: Observation, point: Point) => {
  const maxX = Math.max(1, observation.screenshot.width);
  const maxY = Math.max(1, observation.screenshot.height);
  if (point.x < 0 || point.y < 0 || point.x >= maxX || point.y >= maxY) {
    throw new Error('Native input point is outside the current observed screenshot.');
  }
  return localToGlobalPoint(observation.screenshot.globalBounds, point, observation.screenshot);
};

const requireCursorAtPoint = async (controller: NativeInputController, point: Point, observation: Observation) => {
  const cursor = await controller.getCursorPosition();
  if (!cursor || !pointInsideBounds(cursor, observation.screenshot.globalBounds) || cursor.x !== point.x || cursor.y !== point.y) {
    logError(`Native cursor missed target ${point.x},${point.y}; current position is ${cursor?.x ?? 'unknown'},${cursor?.y ?? 'unknown'}.`);
  }
};

const requireCursorInside = async (controller: NativeInputController, observation: Observation) => {
  const cursor = await controller.getCursorPosition();
  if (!cursor || !pointInsideBounds(cursor, observation.screenshot.globalBounds)) {
    throw new Error('Native cursor is outside the observed target; mouse input aborted.');
  }
};

const clickAt = async (
  controller: NativeInputController,
  point: Point,
  observation: Observation,
  button: NativeInputMouseButton,
  doubleClick?: boolean,
  delayMs?: number,
) => {
  await controller.moveMouseTo(point.x, point.y);
  await requireCursorAtPoint(controller, point, observation);
  await sleep(delayMs ?? clickDelayMs);
  await controller.clickMouse(button);
  if (doubleClick === true) {
    await sleep(doubleClickDelayMs);
    await requireCursorAtPoint(controller, point, observation);
    await controller.clickMouse(button);
  }
};

const withPressedKeys = async <T>(controller: NativeInputController, keys: string[], run: () => Promise<T>) => {
  const normalized = keys.filter(Boolean).map(normalizeKey);
  try {
    for (const key of normalized) await controller.keyDown(key);
    return await run();
  } finally {
    for (const key of normalized.slice().reverse()) await controller.keyUp(key);
  }
};

const typeText = async (controller: NativeInputController, text: string, slowly?: boolean) => {
  if (slowly !== true) return await controller.typeText(text);
  for (const character of text) {
    await controller.typeText(character);
    await sleep(55);
  }
};

const press = async (controller: NativeInputController, key: string) => {
  const keys = key.split('+').map((entry) => normalizeKey(entry.trim())).filter(Boolean);
  return keys.length > 1
    ? await controller.pressKeyCombo(keys)
    : await controller.pressKey(normalizeKey(key));
};

const clickPointAction = async (controller: NativeInputController, action: Extract<NativeAction, { kind: 'clickPoint' }>, observation: Observation) =>
  await clickAt(controller, localPoint(observation, action), observation, normalizeButton(action.button), action.doubleClick, action.delayMs);

const modifierClickPointAction = async (controller: NativeInputController, action: Extract<NativeAction, { kind: 'modifierClickPoint' }>, observation: Observation) =>
  await withPressedKeys(controller, action.modifiers, async () =>
    await clickAt(controller, localPoint(observation, action), observation, normalizeButton(action.button), action.doubleClick, action.delayMs));

const scrollAction = async (controller: NativeInputController, action: Extract<NativeAction, { kind: 'scroll' }>, observation: Observation) => {
  if (typeof action.x === 'number' && typeof action.y === 'number') {
    const point = localPoint(observation, { x: action.x, y: action.y });
    await controller.moveMouseTo(point.x, point.y);
    await requireCursorAtPoint(controller, point, observation);
  }
  await requireCursorInside(controller, observation);
  await controller.scrollMouse(clampNumber(action.deltaY ?? action.delta ?? scrollDefault, scrollMin, scrollMax));
};

const dragPointAction = async (controller: NativeInputController, action: Extract<NativeAction, { kind: 'dragPoint' }>, observation: Observation) => {
  const start = localPoint(observation, { x: action.startX, y: action.startY });
  const end = localPoint(observation, { x: action.endX, y: action.endY });
  await controller.moveMouseTo(start.x, start.y);
  await requireCursorAtPoint(controller, start, observation);
  await controller.dragMouseTo(end.x, end.y, normalizeButton(action.button));
  await requireCursorAtPoint(controller, end, observation);
};

export const runNativeAction = async (action: NativeAction, observation: Observation) => {
  if (boundsWidth(observation.screenshot.globalBounds) <= 0 || boundsHeight(observation.screenshot.globalBounds) <= 0) {
    throw new Error('Observed target bounds are not available.');
  }
  await bringWindowToTop(observation.target.handle);
  const controller = getNativeInputController();
  if (action.kind === 'clickPoint') return await clickPointAction(controller, action, observation);
  if (action.kind === 'modifierClickPoint') return await modifierClickPointAction(controller, action, observation);
  if (action.kind === 'contextClickPoint') return await clickAt(controller, localPoint(observation, action), observation, 'right', false, action.delayMs);
  if (action.kind === 'middleClickPoint') return await clickAt(controller, localPoint(observation, action), observation, 'middle', false, action.delayMs);
  if (action.kind === 'movePoint') {
    const point = localPoint(observation, action);
    return await controller.moveMouseTo(point.x, point.y);
  }
  if (action.kind === 'dragPoint') return await dragPointAction(controller, action, observation);
  if (action.kind === 'typeText') {
    await typeText(controller, action.text, action.slowly);
    return action.submit === true ? await controller.pressKey('Enter') : undefined;
  }
  if (action.kind === 'fileDialogUpload') {
    if (observation.observedTargetType !== 'file-dialog') throw new Error('fileDialogUpload requires an active browser-owned file dialog observation.');
    await controller.typeText(action.path);
    return await controller.pressKey('Enter');
  }
  if (action.kind === 'press') {
    await press(controller, action.key);
    return action.delayMs ? await sleep(action.delayMs) : undefined;
  }
  if (action.kind === 'pressCombo') {
    await controller.pressKeyCombo(action.keys.map(normalizeKey));
    return action.delayMs ? await sleep(action.delayMs) : undefined;
  }
  if (action.kind === 'keyDown') return await controller.keyDown(normalizeKey(action.key));
  if (action.kind === 'keyUp') return await controller.keyUp(normalizeKey(action.key));
  if (action.kind === 'scroll') return await scrollAction(controller, action, observation);
  throw new Error('native input action kind is not supported');
};
