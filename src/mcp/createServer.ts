import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { packageName } from '../defaults';
import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { registerPrompts } from './registerPrompts';
import { registerResources } from './registerResources';
import { registerTools } from './registerTools';

export const createMcpServer = (state: RuntimeState, config: ServerConfig) => {
  const server = new McpServer({
    name: packageName,
    version: '0.1.0',
  });
  registerPrompts(server);
  registerResources(server, state);
  registerTools(server, state, config);
  return server;
};
