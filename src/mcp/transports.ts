import express from 'express';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
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

export const startSse = async (config: ServerConfig) => {
  const app = express();
  const transports: Record<string, SSEServerTransport> = {};
  app.use(express.json({ limit: '4mb' }));
  app.use(['/sse', '/messages'], (req, res, next) => {
    if (authorized(req.header('authorization'), config.sseAuth)) return next();
    res.status(401).send('Unauthorized');
  });
  app.get('/sse', async (_req, res) => {
    try {
      const state = createRuntimeState('sse');
      const server = createMcpServer(state, config);
      const transport = new SSEServerTransport('/messages', res);
      transports[transport.sessionId] = transport;
      transport.onclose = () => {
        delete transports[transport.sessionId];
      };
      await server.connect(transport);
    } catch (error) {
      logError(error);
      if (!res.headersSent) res.status(500).send('SSE initialization failed');
    }
  });
  app.post('/messages', async (req, res) => {
    const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : '';
    const transport = transports[sessionId];
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
