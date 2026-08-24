import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { markObservationConsumed, setLastError } from '../state';
import { createObservation } from '../observation';
import { closeRuntimeBrowser } from '../native/browserRuntime';
import { refreshObservedTarget } from '../native/currentTarget';
import { assertNativeActionSupported, runNativeAction } from '../native/input/actions';
import type { NativeAction } from '../native/input/actionTypes';
import { getNativeInputController } from '../native/input/controller';
import { browserStatus } from '../tools/status';
import { actionSchema } from '../tools/actionSchema';
import { assertNativeActionAllowed } from '../tools/actionPolicy';
import { observationErrorResult, observationResult, toolError } from './toolResults';
import { textResult } from '../util/json';
import { sleep } from '../util/time';
import { actionSettleDelayMs } from '../defaults';
import { browserActToolDescription, browserObserveToolDescription } from '../prompts/browserUse';

const currentObservation = (state: RuntimeState, token: string) => {
  const observation = state.lastObservation;
  if (!observation || observation.observationToken !== token) throw new Error('browser_act requires a matching fresh observationToken.');
  if (observation.consumed || observation.stale) throw new Error('browser_act requires a fresh observationToken; this token is stale or consumed.');
  return observation;
};

export const registerTools = (server: McpServer, state: RuntimeState, config: ServerConfig) => {
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
    async ({ targetUrl, inlineImage }) => {
      try {
        const observation = await createObservation({ state, config, targetUrl, inlineImage });
        return observationResult(observation);
      } catch (error) {
        setLastError(state, error);
        return toolError(error);
      }
    },
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
    async ({ observationToken, action }) => {
      let consumed = false;
      try {
        const observation = currentObservation(state, observationToken);
        const nativeAction = action as unknown as NativeAction;
        assertNativeActionAllowed(nativeAction, config);
        assertNativeActionSupported(nativeAction, observation);
        const refreshed = await refreshObservedTarget(observation, state.browser);
        markObservationConsumed(state);
        consumed = true;
        const actionResult = await runNativeAction(nativeAction, refreshed);
        await sleep(actionSettleDelayMs);
        const next = await createObservation({ state, config, inlineImage: true });
        const details = { consumedObservationToken: observationToken, actionResult };
        return nativeAction.kind === 'fileDialogUpload' && next.observedTargetType === 'file-dialog'
          ? observationErrorResult('The file dialog remained open after fileDialogUpload.', next, details)
          : observationResult(next, details);
      } catch (error) {
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
    },
  );

  server.registerTool(
    'browser_status',
    {
      title: 'Browser Status',
      description: 'Return MCP transport, native input driver, browser process, HWND, monitor, DPI, focus, and observation state.',
    },
    async () => {
      try {
        return textResult({ ok: true, status: await browserStatus(state, config) });
      } catch (error) {
        setLastError(state, error);
        return toolError(error);
      }
    },
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
    async ({ closeBrowser }) => {
      const release: { ok: boolean; error: string | null } = { ok: true, error: null };
      try {
        await getNativeInputController().releaseAll();
      } catch (error) {
        release.ok = false;
        release.error = error instanceof Error ? error.message : String(error);
      }
      const close = closeBrowser === true ? await closeRuntimeBrowser(state) : { closed: false, error: null };
      return textResult({ ok: release.ok && !close.error, released: release, close });
    },
  );
};
