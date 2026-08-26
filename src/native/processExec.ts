import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

const powershellMaxBuffer = 10 * 1024 * 1024;
let powershell: ChildProcessWithoutNullStreams | null = null;
let powershellQueue = Promise.resolve<unknown>(undefined);
let commandId = 0;

const stopPowerShell = () => {
  const running = powershell;
  powershell = null;
  if (running && running.exitCode === null && !running.killed) running.kill();
};

process.once('exit', stopPowerShell);

const ensurePowerShell = () => {
  if (powershell && powershell.exitCode === null && !powershell.killed) return powershell;
  const opened = spawn('powershell.exe', [
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', '-',
  ], { windowsHide: true });
  powershell = opened;
  opened.stderr.resume();
  opened.stdin.on('error', () => {
    if (powershell === opened) stopPowerShell();
  });
  opened.once('exit', () => {
    if (powershell === opened) powershell = null;
  });
  return opened;
};

const executePowerShell = async (script: string, timeoutMs: number) => {
  const running = ensurePowerShell();
  const marker = `__BROWSER_POWERSHELL_${commandId += 1}__`;
  const encoded = Buffer.from(`$ErrorActionPreference='Stop'\n${script}`, 'utf16le').toString('base64');
  const command = `try { Invoke-Expression ([Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('${encoded}'))); [Console]::Out.WriteLine('${marker}:OK') } catch { $message=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.Exception.Message)); [Console]::Out.WriteLine('${marker}:ERR:'+$message) }\n`;
  return await new Promise<string>((resolve, reject) => {
    let output = '';
    const finish = (error?: Error, value = '') => {
      clearTimeout(timer);
      running.stdout.off('data', onData);
      running.off('exit', onExit);
      running.off('error', onError);
      if (error && powershell === running) stopPowerShell();
      error ? reject(error) : resolve(value);
    };
    const onData = (chunk: Buffer) => {
      output += chunk.toString('utf8');
      if (output.length > powershellMaxBuffer) {
        finish(new Error('PowerShell output exceeded the allowed size.'));
        return;
      }
      const match = output.match(new RegExp(`${marker}:(OK|ERR)(?::([^\\r\\n]+))?\\r?\\n`));
      if (!match || match.index === undefined) return;
      const value = output.slice(0, match.index).trim();
      const message = match[2] ? Buffer.from(match[2], 'base64').toString('utf8') : 'PowerShell command failed.';
      finish(match[1] === 'ERR' ? new Error(message) : undefined, value);
    };
    const onExit = () => finish(new Error('PowerShell process stopped unexpectedly.'));
    const onError = (error: Error) => finish(error);
    const timer = setTimeout(() => finish(new Error(`PowerShell command timed out after ${timeoutMs}ms.`)), timeoutMs);
    running.stdout.on('data', onData);
    running.once('exit', onExit);
    running.once('error', onError);
    running.stdin.write(command, 'utf8');
  });
};

export const runTextCommand = async (
  command: string,
  args: string[],
  timeoutMs = 5000,
  maxBuffer = powershellMaxBuffer,
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

export const runPowerShell = async (script: string, timeoutMs = 10000) => {
  const run = powershellQueue.catch(() => undefined).then(() => executePowerShell(script, timeoutMs));
  powershellQueue = run;
  return await run;
};

export const runPowerShellJson = async <T>(script: string, fallback: T, timeoutMs = 10000) => {
  const wrapped = `$browserJsonOutput = @(& {
${script}
})
$browserJsonText = if ($browserJsonOutput.Count -gt 0) { [string]$browserJsonOutput[$browserJsonOutput.Count - 1] } else { '' }
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($browserJsonText))`;
  const parse = async () => {
    const output = await runPowerShell(wrapped, timeoutMs);
    const encoded = output.split(/\r?\n/).filter((entry) => entry.length > 0).at(-1) || '';
    const text = encoded ? Buffer.from(encoded, 'base64').toString('utf8') : '';
    return text.length > 0 ? JSON.parse(text) as T : fallback;
  };
  try {
    return await parse();
  } catch {
    stopPowerShell();
    return await parse();
  }
};
