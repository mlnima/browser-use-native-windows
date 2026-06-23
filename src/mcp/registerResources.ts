import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RuntimeState } from '../state';
import { browserUseNativeWindowsInstructions } from '../prompts/instructions';

export const registerResources = (server: McpServer, state: RuntimeState) => {
  server.registerResource(
    'runtime-status',
    'browser-use-native-windows://runtime-status',
    {
      title: 'Runtime Status',
      description: 'Current browser-use-native-windows runtime state.',
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            sessionId: state.sessionId,
            transport: state.transportMode,
            browser: state.browser
              ? {
                  pid: state.browser.pid,
                  exe: state.browser.exe,
                  userDataDir: state.browser.userDataDir,
                  startedAt: state.browser.startedAt,
                  launchedByMcp: state.browser.launchedByMcp,
                  args: state.browser.args,
                }
              : null,
            browserWindow: state.browserWindow,
            lastObservation: state.lastObservation
              ? {
                  token: state.lastObservation.observationToken,
                  capturedAt: state.lastObservation.capturedAt,
                  consumed: state.lastObservation.consumed,
                  stale: state.lastObservation.stale,
                }
              : null,
            lastError: state.lastError,
          }, null, 2),
        },
      ],
    }),
  );

  server.registerResource(
    'instructions',
    'browser-use-native-windows://instructions',
    {
      title: 'Instructions',
      description: 'Native Windows browser-use instructions.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: browserUseNativeWindowsInstructions }],
    }),
  );
};
