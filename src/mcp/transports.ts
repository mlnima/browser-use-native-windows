import express from 'express';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { ServerConfig } from '../config';
import { createRuntimeState } from '../state';
import { createMcpServer, createStreamableMcpTransport } from './createServer';
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
const setCorsHeaders = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version, Last-Event-ID',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id, MCP-Protocol-Version',
  });
  next();
};
export const startHttp = async (config: ServerConfig, mode: 'mcp' | 'sse' | 'all') => {
  const app = express();
  const sseTransports = new Map<string, SSEServerTransport>();
  const streamableTransports = new Map<string, StreamableHTTPServerTransport>();
  const useMcp = mode !== 'sse';
  const useSse = mode !== 'mcp';
  const paths = [...(useMcp ? ['/mcp'] : []), ...(useSse ? ['/sse', '/messages'] : [])];
  app.use(setCorsHeaders);
  app.options('*', (_req, res) => res.sendStatus(204));
  app.use(express.json({ limit: '4mb' }));
  app.use(paths, (req, res, next) => {
    if (authorized(req.header('authorization'), config.sseAuth)) return next();
    res.status(401).send('Unauthorized');
  });
  useMcp && app.all('/mcp', async (req, res) => {
    try {
      const sessionId = sessionHeader(req.headers['mcp-session-id']);
      const transport = sessionId
        ? streamableTransports.get(sessionId)
        : req.method === 'POST' && isInitializeRequest(req.body)
          ? await createStreamableMcpTransport(config, streamableTransports)
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
  useSse && app.get('/sse', async (_req, res) => {
    try {
      const state = createRuntimeState('sse');
      const server = createMcpServer(state, config);
      const transport = new SSEServerTransport('/messages', res);
      sseTransports.set(transport.sessionId, transport);
      transport.onclose = () => {
        sseTransports.delete(transport.sessionId);
      };
      await server.connect(transport);
    } catch (error) {
      logError(error);
      if (!res.headersSent) res.status(500).send('SSE initialization failed');
    }
  });
  useSse && app.post('/messages', async (req, res) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
    const transport = sseTransports.get(sessionId);
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
