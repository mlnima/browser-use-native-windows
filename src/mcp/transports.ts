import express from 'express';
import { randomUUID } from 'node:crypto';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { ServerConfig } from '../config';
import { createRuntimeState } from '../state';
import { createMcpServer } from './createServer';
import { logError } from '../log';

export const startStdio = async (config: ServerConfig) => {
  const state = createRuntimeState('stdio');
  const server = createMcpServer(state, config);
  await server.connect(new StdioServerTransport());
};

const authorized = (header: unknown, token: string) =>
  typeof header === 'string' && header === `Bearer ${token}`;

const sessionHeader = (header: string | string[] | undefined) =>
  typeof header === 'string' ? header : header?.[0] || '';

const sendMcpError = (res: express.Response, status: number, code: number, message: string) =>
  res.status(status).json({
    jsonrpc: '2.0',
    error: { code, message },
    id: null,
  });

const createStreamableTransport = async (
  config: ServerConfig,
  transports: Record<string, StreamableHTTPServerTransport>,
) => {
  let transport: StreamableHTTPServerTransport;
  transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      transports[sessionId] = transport;
    },
  });
  transport.onclose = () => {
    const sessionId = transport.sessionId;
    if (sessionId) delete transports[sessionId];
  };
  const state = createRuntimeState('mcp');
  const server = createMcpServer(state, config);
  await server.connect(transport);
  return transport;
};

export const startSse = async (config: ServerConfig) => {
  const app = express();
  const sseTransports: Record<string, SSEServerTransport> = {};
  const streamableTransports: Record<string, StreamableHTTPServerTransport> = {};
  app.use(express.json({ limit: '4mb' }));
  app.use(['/mcp', '/sse', '/messages'], (req, res, next) => {
    if (authorized(req.header('authorization'), config.sseAuth)) return next();
    res.status(401).send('Unauthorized');
  });
  app.all('/mcp', async (req, res) => {
    try {
      const sessionId = sessionHeader(req.headers['mcp-session-id']);
      const transport = sessionId
        ? streamableTransports[sessionId]
        : req.method === 'POST' && isInitializeRequest(req.body)
          ? await createStreamableTransport(config, streamableTransports)
          : null;
      if (!transport) {
        sendMcpError(res, sessionId ? 404 : 400, -32000, 'No valid MCP session');
        return;
      }
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logError(error);
      if (!res.headersSent) sendMcpError(res, 500, -32603, 'MCP request handling failed');
    }
  });
  app.get('/sse', async (_req, res) => {
    try {
      const state = createRuntimeState('sse');
      const server = createMcpServer(state, config);
      const transport = new SSEServerTransport('/messages', res);
      sseTransports[transport.sessionId] = transport;
      transport.onclose = () => {
        delete sseTransports[transport.sessionId];
      };
      await server.connect(transport);
    } catch (error) {
      logError(error);
      if (!res.headersSent) res.status(500).send('SSE initialization failed');
    }
  });
  app.post('/messages', async (req, res) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
    const transport = sseTransports[sessionId];
    if (!transport) {
      res.status(404).send('Session not found');
      return;
    }
    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      logError(error);
      if (!res.headersSent) res.status(500).send('Message handling failed');
    }
  });
  await new Promise<void>((resolve, reject) => {
    const server = app.listen(config.ssePort, config.sseHost, () => resolve());
    server.on('error', reject);
  });
};
