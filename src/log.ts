import fs from 'node:fs';
import path from 'node:path';
import { logDir } from './defaults';

let activeLogDir = logDir();

export const configureLogDir = (value: string) => {
  activeLogDir = value;
};

const logItemText = (item: unknown) => {
  if (item instanceof Error) return item.stack || item.message;
  if (typeof item === 'string') return item;
  try {
    return JSON.stringify(item) || String(item);
  } catch {
    return String(item);
  }
};

const logLine = (items: unknown[]) =>
  `${new Date().toISOString()} [browser-use-native-windows] ${items.map(logItemText).join(' ')}
`;

export const logError = (...items: unknown[]) => {
  console.error('[browser-use-native-windows]', ...items);
  try {
    fs.mkdirSync(activeLogDir, { recursive: true });
    fs.appendFileSync(path.join(activeLogDir, 'browser-use-native-windows.log'), logLine(items));
  } catch {
    return;
  }
};
