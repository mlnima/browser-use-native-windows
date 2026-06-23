#!/usr/bin/env node
import { loadConfig } from './config';
import { startSse, startStdio } from './mcp/transports';
import { logError } from './log';
import { startForceStopHotkey } from './native/forceStopHotkey';

const transportArg = process.argv.includes('--transport') || process.argv.includes('-t')
  ? process.argv[process.argv.findIndex((entry) => entry === '--transport' || entry === '-t') + 1]
  : '';

const main = async () => {
  const config = loadConfig();
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
  if (transportArg === 'sse') {
    await startSse(config);
    return;
  }
  await startStdio(config);
};

main().catch((error) => {
  logError(error);
  process.exitCode = 1;
});
