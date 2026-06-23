export const browserUseNativeWindowsRecoveryPrompt = `
If a native action fails because the observation token is stale, consumed, or mismatched, call browser_observe again and retry from the new screenshot.

If the screenshot bounds, focus, or target window changed, call browser_observe again before acting. If a browser-owned file dialog is foreground, treat it as the observed target and use only file-dialog coordinates until it closes.

If node-interception is unavailable, report the driver install and reboot requirement from browser_status. Do not switch to CDP, Playwright, browser scripting, or a full desktop screenshot workaround.
`;
