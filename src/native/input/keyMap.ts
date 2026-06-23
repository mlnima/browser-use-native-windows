export type NativeWindowsKeyEntry = {
  code: number;
  shift?: boolean;
  special?: boolean;
};

export const windowsNativeKeyCodes: Record<string, NativeWindowsKeyEntry> = {
  Backspace: { code: 0x0e },
  Tab: { code: 0x0f },
  Enter: { code: 0x1c },
  Control: { code: 0x1d },
  Shift: { code: 0x2a },
  Alt: { code: 0x38 },
  Escape: { code: 0x01 },
  Space: { code: 0x39 },
  Home: { code: 0x47, special: true },
  Up: { code: 0x48, special: true },
  Down: { code: 0x50, special: true },
  Left: { code: 0x4b, special: true },
  Right: { code: 0x4d, special: true },
  Delete: { code: 0x53, special: true },
  Meta: { code: 0x5b, special: true },
  ' ': { code: 0x39 },
  '-': { code: 0x0c },
  _: { code: 0x0c, shift: true },
  '=': { code: 0x0d },
  '+': { code: 0x0d, shift: true },
  '[': { code: 0x1a },
  '{': { code: 0x1a, shift: true },
  ']': { code: 0x1b },
  '}': { code: 0x1b, shift: true },
  '\\': { code: 0x2b },
  '|': { code: 0x2b, shift: true },
  ';': { code: 0x27 },
  ':': { code: 0x27, shift: true },
  "'": { code: 0x28 },
  '"': { code: 0x28, shift: true },
  '`': { code: 0x29 },
  '~': { code: 0x29, shift: true },
  ',': { code: 0x33 },
  '<': { code: 0x33, shift: true },
  '.': { code: 0x34 },
  '>': { code: 0x34, shift: true },
  '/': { code: 0x35 },
  '?': { code: 0x35, shift: true },
};

const shiftedDigits: Record<string, string> = {
  '!': '1',
  '@': '2',
  '#': '3',
  '$': '4',
  '%': '5',
  '^': '6',
  '&': '7',
  '*': '8',
  '(': '9',
  ')': '0',
};

for (let index = 0; index < 26; index += 1) {
  const lower = String.fromCharCode(97 + index);
  const code = [0x1e, 0x30, 0x2e, 0x20, 0x12, 0x21, 0x22, 0x23, 0x17, 0x24, 0x25, 0x26, 0x32, 0x31, 0x18, 0x19, 0x10, 0x13, 0x1f, 0x14, 0x16, 0x2f, 0x11, 0x2d, 0x15, 0x2c][index]!;
  windowsNativeKeyCodes[lower] = { code };
  windowsNativeKeyCodes[lower.toUpperCase()] = { code, shift: true };
}

for (const [digit, code] of Object.entries({ '1': 0x02, '2': 0x03, '3': 0x04, '4': 0x05, '5': 0x06, '6': 0x07, '7': 0x08, '8': 0x09, '9': 0x0a, '0': 0x0b })) {
  windowsNativeKeyCodes[digit] = { code };
}

for (const [symbol, digit] of Object.entries(shiftedDigits)) {
  windowsNativeKeyCodes[symbol] = { code: windowsNativeKeyCodes[digit]!.code, shift: true };
}
