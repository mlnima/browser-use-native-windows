# browser-use-native-windows

Windows-only MCP server for controlling a real Chromium browser with native screenshots, Windows accessibility, and `node-interception` mouse/keyboard input.

It does not use CDP, Chrome DevTools, Playwright, Puppeteer, browser extensions, DOM selectors, DOM snapshots, or page JavaScript evaluation.

## Requirements

- Windows
- Node.js 20+
- Chromium-based browser: Edge, Chrome, Brave, Chromium, Vivaldi, Opera, Yandex
- `node-interception` driver

Install the native input package and driver from an administrator terminal:

```powershell
npm install -g node-interception
node-interception /install
```

Reboot Windows after driver installation.

## Install

From source:

```powershell
npm install
npm run build
```

Optional global install from this package root:

```powershell
npm install -g .
```

## Configuration

The MCP reads system environment variables first. If a `.env` file exists next to this README, it is loaded as a fallback. The MCP starts normally when `.env` is missing.

Create `.env` from `.env.example` when you want fixed SSE or browser settings:

```env
BROWSER_USE_NATIVE_WINDOWS_SSE_HOST= "0.0.0.0"
BROWSER_USE_NATIVE_WINDOWS_SSE_PORT= "7331"
BROWSER_USE_NATIVE_WINDOWS_SSE_AUTH= "change.me"
BROWSER_USE_NATIVE_WINDOWS_BROWSER_EXECUTABLE_PATH= "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
BROWSER_USE_NATIVE_WINDOWS_BROWSER_USER_DATA_DIR= "C:\Users\YOUR_USER\AppData\Local\Microsoft\Edge\User Data"
```

Change `BROWSER_USE_NATIVE_WINDOWS_SSE_AUTH` before exposing SSE outside your machine.

## Run

Stdio transport:

```powershell
npm run start:stdio
```

SSE transport:

```powershell
npm run start:sse
```

Global install:

```powershell
browser-use-native-windows
browser-use-native-windows --transport sse
```

## MCP Client

Stdio:

```json
{
  "mcpServers": {
    "browser-use-native-windows": {
      "transport": "stdio",
      "command": "node",
      "args": ["<package-root>\\dist\\index.js"],
      "cwd": "<package-root>"
    }
  }
}
```

SSE:

```json
{
  "mcpServers": {
    "browser-use-native-windows": {
      "transport": "sse",
      "url": "http://<host>:7331/sse",
      "headers": {
        "Authorization": "Bearer change.me"
      }
    }
  }
}
```

## Tools

- `browser_observe`: launch or adopt the browser and return a native observation.
- `browser_act`: run one mouse or keyboard action against a fresh observation token.
- `browser_status`: return transport, driver, browser, window, focus, monitor, DPI, and observation state.
- `browser_stop`: release held input state and optionally close the tracked browser.

## Force Stop

Default global hotkey:

```text
Control+F12
```

The watchdog releases held keys and mouse buttons, then stops the MCP process.
