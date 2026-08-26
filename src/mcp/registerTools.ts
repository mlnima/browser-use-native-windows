import { randomUUID } from 'node:crypto';
import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { clearPointerVerification, markObservationConsumed, setLastError } from '../state';
import { createObservation } from '../observation';
import { closeRuntimeBrowser } from '../native/browserRuntime';
import { refreshObservedTarget } from '../native/currentTarget';
import { assertNativeActionSupported, runNativeAction } from '../native/input/actions';
import { actionMayLoadPage, actionNeedsPointerVerification, type NativeAction, type PointerMoveResult } from '../native/input/actionTypes';
import { getNativeInputController } from '../native/input/controller';
import { browserStatus } from '../tools/status';
import { actionSchema } from '../tools/actionSchema';
import { assertNativeActionAllowed } from '../tools/actionPolicy';
import { observationErrorResult, observationResult, toolError } from './toolResults';
import { textResult } from '../util/json';
import { sleep } from '../util/time';
import { actionSettleDelayMs } from '../defaults';
import { browserActToolDescription, browserObserveToolDescription } from '../prompts/browserUse';
import type { RuntimeCoordinator } from './runtimeCoordinator';

const currentObservation = (state: RuntimeState, token: string) => {
  const observation = state.lastObservation;
  if (!observation || observation.observationToken !== token) throw new Error('browser_act requires a matching fresh observationToken.');
  if (observation.consumed || observation.stale) throw new Error('browser_act requires a fresh observationToken; this token is stale or consumed.');
  return observation;
};

const pointerVerificationForAction = (state: RuntimeState, action: NativeAction, observation: ReturnType<typeof currentObservation>) => {
  if (!actionNeedsPointerVerification(action)) return undefined;
  const pointer = state.pointerVerification;
  if (!pointer || pointer.token !== action.pointerVerificationToken || pointer.observationToken !== observation.observationToken) {
    throw new Error('This action requires the pointerVerification token from the immediately preceding move screenshot.');
  }
  if (pointer.targetHandle !== observation.target.handle) throw new Error('The pointer verification belongs to a different browser target.');
  return pointer;
};

const isPointerMoveResult = (result: unknown): result is PointerMoveResult =>
  !!result && typeof result === 'object' && (result as { kind?: string }).kind === 'pointerMoved';

const verifyMoveScreenshot = (state: RuntimeState, observation: ReturnType<typeof currentObservation>, result: PointerMoveResult) => {
  const cursor = observation.screenshot.cursor;
  if (!cursor.visible || !cursor.position || !cursor.globalPosition ||
    cursor.globalPosition.x !== result.target.globalPoint.x || cursor.globalPosition.y !== result.target.globalPoint.y) {
    throw new Error('The post-move screenshot did not capture the physical cursor at the intended target; clicking is blocked.');
  }
  const pointer = {
    ...result.target,
    localPoint: cursor.position,
    token: randomUUID(),
    observationToken: observation.observationToken,
    targetHandle: observation.target.handle,
  };
  state.pointerVerification = pointer;
  return {
    token: pointer.token,
    target: pointer.localPoint,
    nodeId: pointer.nodeId,
    nodeName: pointer.nodeName,
    cursorVisibleInScreenshot: true,
  };
};

export const registerTools = (
  server: McpServer,
  state: RuntimeState,
  config: ServerConfig,
  coordinator: RuntimeCoordinator,
) => {
  server.registerTool(
    'browser_observe',
    {
      title: 'Observe Browser',
      description: browserObserveToolDescription,
      inputSchema: {
        targetUrl: z.string().optional(),
        inlineImage: z.boolean().optional(),
      },
    },
    async ({ targetUrl, inlineImage }) => await coordinator.run(async () => {
      clearPointerVerification(state);
      try {
        const observation = await createObservation({ state, config, targetUrl, inlineImage });
        return observationResult(observation);
      } catch (error) {
        setLastError(state, error);
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    'browser_act',
    {
      title: 'Act In Browser',
      description: browserActToolDescription,
      inputSchema: {
        observationToken: z.string(),
        action: actionSchema,
      },
    },
    async ({ observationToken, action }) => await coordinator.run(async () => {
      let consumed = false;
      try {
        const observation = currentObservation(state, observationToken);
        const nativeAction = action as unknown as NativeAction;
        assertNativeActionAllowed(nativeAction, config);
        assertNativeActionSupported(nativeAction, observation);
        const pointer = pointerVerificationForAction(state, nativeAction, observation);
        const refreshed = await refreshObservedTarget(observation, state.browser);
        clearPointerVerification(state);
        markObservationConsumed(state);
        consumed = true;
        const pageLoadStartedAt = Date.now();
        const actionResult = await runNativeAction(nativeAction, refreshed, pointer);
        await sleep(actionSettleDelayMs);
        const next = await createObservation({
          state,
          config,
          inlineImage: true,
          previousObservation: observation,
          pageLoadStartedAt,
          waitForLoad: actionMayLoadPage(nativeAction),
        });
        const pointerVerification = isPointerMoveResult(actionResult)
          ? verifyMoveScreenshot(state, next, actionResult)
          : undefined;
        const publicActionResult = isPointerMoveResult(actionResult)
          ? {
              cursorVerified: actionResult.cursorVerified,
              target: actionResult.target.localPoint,
              nodeId: actionResult.target.nodeId,
              nodeName: actionResult.target.nodeName,
            }
          : actionResult;
        const details = { consumedObservationToken: observationToken, actionResult: publicActionResult, pointerVerification };
        return nativeAction.kind === 'fileDialogUpload' && next.observedTargetType === 'file-dialog'
          ? observationErrorResult('The file dialog remained open after fileDialogUpload.', next, details)
          : observationResult(next, details);
      } catch (error) {
        clearPointerVerification(state);
        setLastError(state, error);
        try {
          await getNativeInputController().releaseAll();
        } catch (releaseError) {
          setLastError(state, releaseError);
        }
        if (consumed && state.browser) {
          try {
            await sleep(actionSettleDelayMs);
            const recovery = await createObservation({ state, config, inlineImage: true });
            return observationErrorResult(error, recovery, { consumedObservationToken: observationToken });
          } catch (observationError) {
            setLastError(state, observationError);
          }
        }
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    'browser_status',
    {
      title: 'Browser Status',
      description: 'Return MCP transport, native input driver, browser process, HWND, monitor, DPI, focus, and observation state.',
    },
    async () => await coordinator.run(async () => {
      try {
        return textResult({ ok: true, status: await browserStatus(state, config) });
      } catch (error) {
        setLastError(state, error);
        return toolError(error);
      }
    }),
  );

  server.registerTool(
    'browser_stop',
    {
      title: 'Stop Browser Control',
      description: 'Release held native input state and optionally close the tracked browser only when the user task asks for it.',
      inputSchema: {
        closeBrowser: z.boolean().optional(),
      },
    },
    async ({ closeBrowser }) => await coordinator.run(async () => {
      clearPointerVerification(state);
      const release: { ok: boolean; error: string | null } = { ok: true, error: null };
      try {
        await getNativeInputController().releaseAll();
      } catch (error) {
        release.ok = false;
        release.error = error instanceof Error ? error.message : String(error);
      }
      const close = closeBrowser === true ? await closeRuntimeBrowser(state) : { closed: false, error: null };
      return textResult({ ok: release.ok && !close.error, released: release, close });
    }),
  );
};
