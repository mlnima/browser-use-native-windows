import { execFile } from 'node:child_process';

export const runTextCommand = async (
  command: string,
  args: string[],
  timeoutMs = 5000,
  maxBuffer = 10 * 1024 * 1024,
) =>
  await new Promise<string>((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs, maxBuffer, windowsHide: true }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(String(stdout || '').trim());
    });
  });

export const runTextCommandOrEmpty = async (
  command: string,
  args: string[],
  timeoutMs = 5000,
) => {
  try {
    return await runTextCommand(command, args, timeoutMs);
  } catch {
    return '';
  }
};

export const runPowerShell = async (script: string, timeoutMs = 10000) =>
  await runTextCommand(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    timeoutMs,
  );

export const runPowerShellJson = async <T>(script: string, fallback: T, timeoutMs = 10000) => {
  const text = await runPowerShell(script, timeoutMs);
  return text.length > 0 ? JSON.parse(text) as T : fallback;
};
