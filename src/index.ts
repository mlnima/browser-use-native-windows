#!/usr/bin/env node
import { loadConfig } from './config';
import { startHttp, startStdio } from './mcp/transports';
import { configureLogDir, logError } from './log';
import { startForceStopHotkey } from './native/forceStopHotkey';

const transportArg = process.argv.includes('--transport') || process.argv.includes('-t')
  ? process.argv[process.argv.findIndex((entry) => entry === '--transport' || entry === '-t') + 1]
  : '';

const main = async () => {
  const config = loadConfig();
  configureLogDir(config.logDir);
  const forceStopHotkey = startForceStopHotkey(config);
  const stopForceStopHotkey = () => forceStopHotkey?.stop();
  process.once('exit', stopForceStopHotkey);
  process.once('SIGINT', () => {
    stopForceStopHotkey();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    stopForceStopHotkey();
    process.exit(143);
  });
  const transport = transportArg || 'stdio';
  const transports: Record<string, () => Promise<void>> = {
    stdio: () => startStdio(config),
    mcp: () => startHttp(config, 'mcp'),
    sse: () => startHttp(config, 'sse'),
    all: () => startHttp(config, 'all'),
  };
  const start = transports[transport];
  if (!start) throw new Error(`Unsupported transport "${transport}". Use stdio, mcp, sse, or all.`);
  await start();
};

main().catch((error) => {
  logError(error);
  process.exitCode = 1;
});
