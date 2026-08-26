export const browserUseNativeWindowsCorePrompt = `
Use browser-use-native-windows for Windows browser tasks that require a real browser window.

Operate only from the returned app screenshot and Windows accessibility nodes. Every mouse coordinate is a pixel in that screenshot: x starts at 0 on its left edge and y starts at 0 on its top edge. Never calculate or send desktop-global coordinates. Call browser_observe before the first browser_act, then continue with the fresh observationToken and screenshot returned by each browser_act.

Use targetUrl on browser_observe only when the user task names a page to open. If the user wants the current open browser page, omit targetUrl. If targetUrlStatus is unknown, decide from the screenshot and task context before acting.
`;

export const browserUseNativeWindowsNativeInputPrompt = `
Use native mouse and keyboard actions only. Do not use DOM selectors, browser scripting, Chrome DevTools, Playwright, page evaluation, extensions, or CDP concepts.

Every click requires two separate browser_act calls. First use moveNode(nodeId) for an accessibility target, or movePoint(x,y) only when no accessibility node represents the visible target. The move action returns a new screenshot containing the real Windows cursor and a pointerVerification token. Inspect that screenshot and confirm the cursor is on the intended target. Only then call clickCurrentPointer(pointerVerificationToken,button?,modifiers?) with the returned observationToken. clickCurrentPointer never moves the cursor and is rejected without that exact post-move verification. Never estimate a point for a named accessibility control or browser chrome. To drag, verify the start with moveNode or movePoint, then use dragFromCurrentPointer. For text and key actions, use browser_act with typeText, press, pressCombo, keyDown, or keyUp. Use fileDialogUpload(path) only after a verified click has opened and observed the file dialog.

For scrolling, first use moveNode or movePoint to place the cursor inside the intended scrollable element, not on its scrollbar. Inspect the returned cursor screenshot, then use scrollCurrentPointer(pointerVerificationToken,direction,steps?) to send native mouse-wheel input without moving the cursor. Never click or drag a scrollbar to scroll. Confirm from the returned screenshot that the intended element moved; otherwise repeat the move-verification sequence at another point inside that element or report the blocker.
`;

export const browserObserveToolDescription = `
Launch exactly the configured browser executable with its configured user data and arguments, then return only that newly opened window or its owned dialog image. All visible element bounds and centers are app-screenshot pixels.
`;

export const browserActToolDescription = `
Run one native action against a matching fresh observation token. The result includes the next fresh observation and screenshot. Mouse clicks, drags, and wheel scrolling require a preceding moveNode or movePoint result and its pointerVerification token; they never move the cursor themselves.
`;

export const browserActionDescription = `
Native action kinds and fields: moveNode(nodeId), movePoint(x,y), clickCurrentPointer(pointerVerificationToken,button?,modifiers?), dragFromCurrentPointer(pointerVerificationToken,endX,endY,button?), typeText(text,submit?,slowly?), fileDialogUpload(path), press(key), pressCombo(keys), keyDown(key), keyUp(key), scrollCurrentPointer(pointerVerificationToken,direction,steps?).
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
