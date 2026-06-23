export const browserUseNativeWindowsCorePrompt = `
Use browser-use-native-windows for Windows browser tasks that require a real browser window.

Operate only from the browser_observe screenshot, screenshot metadata, and Windows accessibility nodes. Coordinates are local to the current observed screenshot. Always call browser_observe before browser_act, and use the exact observationToken returned by that observation.

Use targetUrl on browser_observe only when the user task names a page to open. If the user wants the current open browser page, omit targetUrl. If targetUrlStatus is unknown, decide from the screenshot and task context before acting.
`;

export const browserUseNativeWindowsNativeInputPrompt = `
Use native mouse and keyboard actions only. Do not use DOM selectors, browser scripting, Chrome DevTools, Playwright, page evaluation, extensions, or CDP concepts.

For mouse actions, choose points from the returned screenshot coordinate space. For text and key actions, use browser_act with typeText, press, pressCombo, keyDown, or keyUp. For file upload dialogs, observe the browser-owned file dialog and either navigate it manually with native actions or use fileDialogUpload when the exact path is known.
`;

export const browserUseNativeWindowsPrompt = `
${browserUseNativeWindowsCorePrompt}

${browserUseNativeWindowsNativeInputPrompt}
`;
