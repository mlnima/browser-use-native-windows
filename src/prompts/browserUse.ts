export const browserUseNativeWindowsCorePrompt = `
Use browser-use-native-windows for Windows browser tasks that require a real browser window.

Operate only from the browser_observe app screenshot and Windows accessibility nodes. Every mouse coordinate is a pixel in that screenshot: x starts at 0 on its left edge and y starts at 0 on its top edge. Never calculate or send desktop-global coordinates. Always call browser_observe before browser_act, and use the exact observationToken returned by that observation.

Use targetUrl on browser_observe only when the user task names a page to open. If the user wants the current open browser page, omit targetUrl. If targetUrlStatus is unknown, decide from the screenshot and task context before acting.
`;

export const browserUseNativeWindowsNativeInputPrompt = `
Use native mouse and keyboard actions only. Do not use DOM selectors, browser scripting, Chrome DevTools, Playwright, page evaluation, extensions, or CDP concepts.

For mouse actions, choose points from the returned screenshot coordinate space. For text and key actions, use browser_act with typeText, press, pressCombo, keyDown, or keyUp. For file upload dialogs, observe the browser-owned file dialog and either navigate it manually with native actions or use fileDialogUpload when the exact path is known.
`;

export const browserObserveToolDescription = `
Launch exactly the configured browser executable with its configured user data and arguments, then return only that newly opened window or its owned dialog image. All visible element bounds and centers are app-screenshot pixels.
`;

export const browserActToolDescription = `
Run one native action against a matching fresh browser_observe token. Mouse x/y values must be copied from the returned app screenshot or a local accessibility center; the MCP converts them to physical desktop coordinates.
`;

export const browserScreenshotXDescription = `
Horizontal pixel in the current browser_observe app screenshot, from 0 through screenshot.width - 1. Never use globalCenter or desktop coordinates.
`;

export const browserScreenshotYDescription = `
Vertical pixel in the current browser_observe app screenshot, from 0 through screenshot.height - 1. Never use globalCenter or desktop coordinates.
`;

export const browserUseNativeWindowsPrompt = `
${browserUseNativeWindowsCorePrompt}

${browserUseNativeWindowsNativeInputPrompt}
`;
