import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { browserUseNativeWindowsPrompt } from '../prompts/browserUse';
import { browserUseNativeWindowsRecoveryPrompt } from '../prompts/recovery';

export const registerPrompts = (server: McpServer) => {
  server.registerPrompt(
    'browser_use_native_windows',
    {
      title: 'Browser Use Native Windows',
      description: 'Use browser-use-native-windows with native screenshots, accessibility, mouse, and keyboard.',
    },
    async () => ({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: browserUseNativeWindowsPrompt },
        },
      ],
    }),
  );

  server.registerPrompt(
    'browser_use_native_windows_recovery',
    {
      title: 'Browser Use Native Windows Recovery',
      description: 'Recover from stale observations, focus changes, bounds changes, and missing native input driver.',
    },
    async () => ({
      messages: [
        {
          role: 'user',
          content: { type: 'text', text: browserUseNativeWindowsRecoveryPrompt },
        },
      ],
    }),
  );
};
