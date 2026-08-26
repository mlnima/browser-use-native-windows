export const browserUseNativeWindowsCorePrompt = `
Use browser-use-native-windows for Windows browser tasks that require a real browser window.

Operate only from the returned app screenshot and Windows accessibility nodes. Every mouse coordinate is a pixel in that screenshot: x starts at 0 on its left edge and y starts at 0 on its top edge. Never calculate or send desktop-global coordinates. Call browser_observe before the first browser_act, then continue with the fresh observationToken and screenshot returned by each browser_act.

Use targetUrl on browser_observe only when the user task names a page to open. If the user wants the current open browser page, omit targetUrl. If targetUrlStatus is unknown, decide from the screenshot and task context before acting.
`;

export const browserUseNativeWindowsNativeInputPrompt = `
Use native mouse and keyboard actions only. Do not use DOM selectors, browser scripting, Chrome DevTools, Playwright, page evaluation, extensions, or CDP concepts.

For every target represented in accessibilityNodes, use clickNode with that node id. clickNode moves the physical cursor to the returned node center, verifies the cursor, and clicks. Use clickPoint only when no accessibility node represents the visible target and keep it inside screenshot.contentBounds; never estimate a point for a named accessibility control or browser chrome. For text and key actions, use browser_act with typeText, press, pressCombo, keyDown, or keyUp. When the exact upload path is known, use fileDialogUpload(path,x,y) on the visible file chooser to open and complete the dialog in one action. If the dialog is already observed, use fileDialogUpload(path) without x/y.
`;

export const browserObserveToolDescription = `
Launch exactly the configured browser executable with its configured user data and arguments, then return only that newly opened window or its owned dialog image. All visible element bounds and centers are app-screenshot pixels.
`;

export const browserActToolDescription = `
Run one native action against a matching fresh observation token. The result includes the next fresh observation and screenshot, so continue with that returned token without calling browser_observe again. Use clickNode for accessibility controls. Raw point clicks that overlap an accessibility control are rejected to prevent clicking a different control.
`;

export const browserActionDescription = `
Native action kinds and fields: clickNode(nodeId,modifiers?,button?,doubleClick?), clickPoint(x,y,button?,doubleClick?), modifierClickPoint(x,y,modifiers), contextClickPoint(x,y), middleClickPoint(x,y), movePoint(x,y), dragPoint(startX,startY,endX,endY,button?), typeText(text,submit?,slowly?), fileDialogUpload(path,x?,y?), press(key), pressCombo(keys), keyDown(key), keyUp(key), scroll(x?,y?,deltaY?).
`;

export const browserKeyDescription = `
Key names accept common aliases without case sensitivity, including Ctrl or Control, Alt, Shift, Enter, Tab, Escape, Space, arrows, letters, digits, and symbols.
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
