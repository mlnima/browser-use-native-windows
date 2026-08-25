import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { packageName } from '../defaults';
import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { registerPrompts } from './registerPrompts';
import { registerResources } from './registerResources';
import { registerTools } from './registerTools';
import type { RuntimeCoordinator } from './runtimeCoordinator';

export const createMcpServer = (
  state: RuntimeState,
  config: ServerConfig,
  coordinator: RuntimeCoordinator,
) => {
  const server = new McpServer({
    name: packageName,
    version: '0.1.0',
  });
  registerPrompts(server);
  registerResources(server, state);
  registerTools(server, state, config, coordinator);
  return server;
};

export const createStreamableMcpTransport = async (
  state: RuntimeState,
  config: ServerConfig,
  coordinator: RuntimeCoordinator,
  transports: Map<string, StreamableHTTPServerTransport>,
  onClose: () => void,
) => {
  let transport: StreamableHTTPServerTransport;
  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => void transports.set(sessionId, transport),
  });
  transport.onclose = () => {
    const sessionId = transport.sessionId;
    if (sessionId) transports.delete(sessionId);
    onClose();
  };
  await createMcpServer(state, config, coordinator).connect(transport);
  return transport;
};
