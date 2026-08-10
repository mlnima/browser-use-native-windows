import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { packageName } from '../defaults';
import type { ServerConfig } from '../config';
import { createRuntimeState, type RuntimeState } from '../state';
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

export const createStreamableMcpTransport = async (
  config: ServerConfig,
  transports: Map<string, StreamableHTTPServerTransport>,
) => {
  let transport: StreamableHTTPServerTransport;
  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => void transports.set(sessionId, transport),
  });
  transport.onclose = () => {
    const sessionId = transport.sessionId;
    if (sessionId) transports.delete(sessionId);
  };
  await createMcpServer(createRuntimeState('mcp'), config).connect(transport);
  return transport;
};
