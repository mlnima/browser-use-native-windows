import type { NativeInputMouseButton, Observation, Point } from '../../types';
import { clickDelayMs, scrollDefaultSteps, scrollMaxSteps, wheelDelta } from '../../defaults';
import { boundsHeight, boundsWidth, localToGlobalPoint, pointInsideBounds } from '../geometry';
import { bringWindowToTop, getForegroundWindow, getForegroundWindowHandle, pointBelongsToWindow, refreshWindow } from '../windowsWindow';
import { sleep } from '../../util/time';
import { logError } from '../../log';
import { getNativeInputController } from './controller';
import { normalizeWindowsKey, windowsKeyEntry } from './keyMap';
import type { NativeAction, PointerMoveResult, PointerVerification } from './actionTypes';
import type { NativeInputController } from './types';

const normalizeButton = (button?: NativeInputMouseButton): NativeInputMouseButton =>
  button === 'right' || button === 'middle' ? button : 'left';

const interactiveRoles = new Set(['CheckBox', 'RadioButton', 'Edit', 'ComboBox', 'Button', 'Slider', 'Spinner', 'Hyperlink', 'MenuItem', 'ListItem']);

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
    const message = `Native cursor missed target ${point.x},${point.y}; current position is ${cursor?.x ?? 'unknown'},${cursor?.y ?? 'unknown'}.`;
    logError(message);
    throw new Error(message);
  }
};

const requireOwnedTarget = async (observation: Observation, point?: Point) => {
  if (await getForegroundWindowHandle() !== observation.target.handle) {
    throw new Error('Owned browser target is not foreground; native input aborted.');
  }
  const current = observation.observedTargetType === 'browser-window'
    ? await refreshWindow(observation.target)
    : await getForegroundWindow();
  if (!current || current.handle !== observation.target.handle || current.processId !== observation.target.processId ||
    current.executablePath.toLowerCase() !== observation.target.executablePath.toLowerCase()) {
    throw new Error('Owned browser target identity changed; native input aborted.');
  }
  if (point && !await pointBelongsToWindow(observation.target.handle, point)) {
    throw new Error('Native input point is covered by or belongs to another window.');
  }
};

const withPressedKeys = async <T>(controller: NativeInputController, keys: string[], run: () => Promise<T>) => {
  const normalized = keys.filter(Boolean).map(normalizeWindowsKey);
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
  const keys = key.split('+').map((entry) => normalizeWindowsKey(entry)).filter(Boolean);
  return keys.length > 1
    ? await controller.pressKeyCombo(keys)
    : await controller.pressKey(normalizeWindowsKey(key));
};

const nodeArea = (node: Observation['accessibilityNodes'][number]) =>
  Math.max(0, node.bounds.right - node.bounds.left) * Math.max(0, node.bounds.bottom - node.bounds.top);

const nodeAtPoint = (observation: Observation, point: Point) =>
  observation.accessibilityNodes
    .filter((node) => interactiveRoles.has(node.role) && pointInsideBounds(point, node.bounds))
    .sort((left, right) => nodeArea(left) - nodeArea(right))[0] || null;

export const assertNativeActionSupported = (action: NativeAction, observation: Observation) => {
  const keys = action.kind === 'clickCurrentPointer'
    ? action.modifiers || []
    : action.kind === 'press'
      ? action.key.split('+')
      : action.kind === 'pressCombo'
        ? action.keys
        : action.kind === 'keyDown' || action.kind === 'keyUp'
          ? [action.key]
          : [];
  keys.filter(Boolean).forEach((key) => windowsKeyEntry(key));
  const point = action.kind === 'movePoint' ? { x: action.x, y: action.y } : null;
  if (point && observation.observedTargetType === 'browser-window' && observation.screenshot.contentBounds &&
    !pointInsideBounds(point, observation.screenshot.contentBounds)) {
    throw new Error('movePoint is outside webpage content. Use moveNode for browser controls.');
  }
  const node = point ? nodeAtPoint(observation, point) : null;
  if (node) throw new Error(`movePoint overlaps accessibility node ${node.id} (${node.role} "${node.name}"). Use moveNode with the intended node id.`);
  if (action.kind === 'fileDialogUpload' && observation.observedTargetType !== 'file-dialog') {
    throw new Error('fileDialogUpload requires an observed file dialog opened by a verified pointer click.');
  }
};

const moveToPoint = async (
  controller: NativeInputController,
  observation: Observation,
  globalPoint: Point,
  localTarget: Point,
  node?: { id: string; name: string },
): Promise<PointerMoveResult> => {
  await requireOwnedTarget(observation, globalPoint);
  await controller.moveMouseTo(globalPoint.x, globalPoint.y);
  await requireCursorAtPoint(controller, globalPoint, observation);
  await requireOwnedTarget(observation, globalPoint);
  return {
    kind: 'pointerMoved',
    cursorVerified: true,
    target: {
      globalPoint,
      localPoint: localTarget,
      ...(node ? { nodeId: node.id, nodeName: node.name } : {}),
    },
  };
};

const moveNodeAction = async (controller: NativeInputController, action: Extract<NativeAction, { kind: 'moveNode' }>, observation: Observation) => {
  const node = observation.accessibilityNodes.find((entry) => entry.id === action.nodeId);
  if (!node) throw new Error(`Accessibility node is unavailable: ${action.nodeId}`);
  if (!interactiveRoles.has(node.role)) throw new Error(`Accessibility node is not interactive: ${action.nodeId}`);
  return await moveToPoint(controller, observation, localPoint(observation, node.center), node.center, node);
};

const clickCurrentPointerAction = async (
  controller: NativeInputController,
  action: Extract<NativeAction, { kind: 'clickCurrentPointer' }>,
  observation: Observation,
  pointer: PointerVerification,
) => {
  const click = async () => {
    await sleep(action.delayMs ?? clickDelayMs);
    await requireCursorAtPoint(controller, pointer.globalPoint, observation);
    await requireOwnedTarget(observation, pointer.globalPoint);
    await controller.clickMouse(normalizeButton(action.button), pointer.globalPoint);
  };
  action.modifiers?.length ? await withPressedKeys(controller, action.modifiers, click) : await click();
  return { cursorVerified: true, target: pointer.localPoint };
};

const dragFromCurrentPointerAction = async (
  controller: NativeInputController,
  action: Extract<NativeAction, { kind: 'dragFromCurrentPointer' }>,
  observation: Observation,
  pointer: PointerVerification,
) => {
  const end = localPoint(observation, { x: action.endX, y: action.endY });
  await requireCursorAtPoint(controller, pointer.globalPoint, observation);
  await requireOwnedTarget(observation, pointer.globalPoint);
  await requireOwnedTarget(observation, end);
  await controller.dragMouseTo(end.x, end.y, normalizeButton(action.button));
  await requireCursorAtPoint(controller, end, observation);
  await requireOwnedTarget(observation, end);
  return { cursorVerified: true, target: { x: action.endX, y: action.endY } };
};

const fileDialogUploadAction = async (controller: NativeInputController, action: Extract<NativeAction, { kind: 'fileDialogUpload' }>, observation: Observation) => {
  await requireOwnedTarget(observation);
  await controller.pressKeyCombo(['Alt', 'n']);
  await controller.pressKeyCombo(['Control', 'a']);
  await controller.typeText(action.path);
  return await controller.pressKey('Enter');
};

const scrollCurrentPointerAction = async (
  controller: NativeInputController,
  action: Extract<NativeAction, { kind: 'scrollCurrentPointer' }>,
  observation: Observation,
  pointer: PointerVerification,
) => {
  const steps = Math.min(Math.max(Math.round(action.steps ?? scrollDefaultSteps), 1), scrollMaxSteps);
  const delta = steps * wheelDelta * (action.direction === 'down' ? -1 : 1);
  await requireCursorAtPoint(controller, pointer.globalPoint, observation);
  await requireOwnedTarget(observation, pointer.globalPoint);
  await controller.scrollMouse(pointer.globalPoint, delta);
  return { cursorVerified: true, direction: action.direction, steps, target: pointer.localPoint };
};

export const runNativeAction = async (action: NativeAction, observation: Observation, pointer?: PointerVerification) => {
  if (boundsWidth(observation.screenshot.globalBounds) <= 0 || boundsHeight(observation.screenshot.globalBounds) <= 0) {
    throw new Error('Observed target bounds are not available.');
  }
  if (!await bringWindowToTop(observation.target.handle)) throw new Error('Observed target could not be made foreground; native input aborted.');
  await requireOwnedTarget(observation);
  const controller = getNativeInputController();
  if (action.kind === 'moveNode') return await moveNodeAction(controller, action, observation);
  if (action.kind === 'movePoint') return await moveToPoint(controller, observation, localPoint(observation, action), action);
  if (action.kind === 'clickCurrentPointer') return await clickCurrentPointerAction(controller, action, observation, pointer!);
  if (action.kind === 'dragFromCurrentPointer') return await dragFromCurrentPointerAction(controller, action, observation, pointer!);
  if (action.kind === 'typeText') {
    await requireOwnedTarget(observation);
    await typeText(controller, action.text, action.slowly);
    return action.submit === true ? await controller.pressKey('Enter') : undefined;
  }
  if (action.kind === 'fileDialogUpload') return await fileDialogUploadAction(controller, action, observation);
  if (action.kind === 'press') {
    await requireOwnedTarget(observation);
    await press(controller, action.key);
    return action.delayMs ? await sleep(action.delayMs) : undefined;
  }
  if (action.kind === 'pressCombo') {
    await requireOwnedTarget(observation);
    await controller.pressKeyCombo(action.keys.map(normalizeWindowsKey));
    return action.delayMs ? await sleep(action.delayMs) : undefined;
  }
  if (action.kind === 'keyDown') return await requireOwnedTarget(observation), await controller.keyDown(normalizeWindowsKey(action.key));
  if (action.kind === 'keyUp') return await requireOwnedTarget(observation), await controller.keyUp(normalizeWindowsKey(action.key));
  if (action.kind === 'scrollCurrentPointer') return await scrollCurrentPointerAction(controller, action, observation, pointer!);
  throw new Error('native input action kind is not supported');
};
