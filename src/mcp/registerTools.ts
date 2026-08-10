import * as z from 'zod/v4';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { markObservationConsumed, setLastError } from '../state';
import { createObservation } from '../observation';
import { refreshObservedTarget } from '../native/currentTarget';
import { runNativeAction } from '../native/input/actions';
import type { NativeAction } from '../native/input/actionTypes';
import { getNativeInputController } from '../native/input/controller';
import { closeWindowByHandle } from '../native/windowsWindow';
import { browserStatus } from '../tools/status';
import { actionSchema } from '../tools/actionSchema';
import { assertNativeActionAllowed } from '../tools/actionPolicy';
import { observationResult, toolError } from './toolResults';
import { textResult } from '../util/json';
import { sleep } from '../util/time';
import { browserActToolDescription, browserObserveToolDescription } from '../prompts/browserUse';

const currentObservation = (state: RuntimeState, token: string) => {
  const observation = state.lastObservation;
  if (!observation || observation.observationToken !== token) throw new Error('browser_act requires a matching fresh observationToken.');
  if (observation.consumed || observation.stale) throw new Error('browser_act requires a fresh observationToken; this token is stale or consumed.');
  return observation;
};

const closeTrackedBrowser = async (state: RuntimeState) => {
  const handle = state.browser?.launchedByMcp ? state.browser.windowHandle : '';
  if (!handle) return { closed: false, error: 'No MCP-launched browser HWND is available.' };
  const posted = await closeWindowByHandle(handle);
  if (!posted) return { closed: false, error: 'Browser HWND close message could not be posted.' };
  await sleep(500);
  const proc = state.browser?.proc;
  if (state.browser?.launchedByMcp && proc && proc.exitCode === null && !proc.killed) {
    proc.kill();
  }
  state.browser = null;
  state.browserWindow = null;
  return { closed: true, error: null };
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
      try {
        const observation = currentObservation(state, observationToken);
        markObservationConsumed(state);
        const nativeAction = action as NativeAction;
        assertNativeActionAllowed(nativeAction, config);
        const actionResult = await runNativeAction(nativeAction, await refreshObservedTarget(observation, state.browser));
        return textResult({ ok: true, consumedObservationToken: observationToken, actionResult });
      } catch (error) {
        setLastError(state, error);
        try {
          await getNativeInputController().releaseAll();
        } catch (releaseError) {
          setLastError(state, releaseError);
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
      const close = closeBrowser === true ? await closeTrackedBrowser(state) : { closed: false, error: null };
      return textResult({ ok: release.ok && !close.error, released: release, close });
    },
  );
};
