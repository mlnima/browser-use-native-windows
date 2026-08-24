export const browserUseNativeWindowsRecoveryPrompt = `
If a native action fails and returns a recovery observation, retry from its fresh token and screenshot. Call browser_observe only when no recovery observation was returned or the token is stale, consumed, or mismatched.

If the screenshot bounds, focus, or target window changed, call browser_observe again before acting. If a browser-owned file dialog is foreground, treat it as the observed target and use only file-dialog coordinates until it closes.

If native Windows input is unavailable, report the browser_status error. Do not switch to CDP, Playwright, browser scripting, or a full desktop screenshot workaround.
`;
