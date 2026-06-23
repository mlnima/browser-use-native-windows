# browser-use-native-windows

Standalone Windows-only MCP server for controlling a real browser through native screenshots, Windows accessibility, and `node-interception` mouse/keyboard input.

## Scope

- Windows only.
- Native input only.
- No CDP, Chrome DevTools, Playwright, Puppeteer, browser extensions, DOM selectors, DOM snapshots, or JavaScript evaluation.
- No dependency on any internal package from this repository.

## Driver

Install the `node-interception` driver as administrator, reboot Windows, then start the MCP server.

```powershell
npx node-interception /install
```

## Stdio

Generic client config:

```json
{
  "mcpServers": {
    "browser-use-native-windows": {
      "command": "node",
      "args": [
        "<repo-root>\\packages\\browser-use-native-windows\\dist\\index.js"
      ],
      "cwd": "<repo-root>\\packages\\browser-use-native-windows"
    }
  }
}
```

Project MCP settings shape:

```json
{
  "mcpServers": {
    "browser-use-native-windows": {
      "transport": "stdio",
      "command": "node",
      "args": [
        "<repo-root>\\packages\\browser-use-native-windows\\dist\\index.js"
      ],
      "cwd": "<repo-root>\\packages\\browser-use-native-windows"
    }
  }
}
```

## SSE

Start the server:

```powershell
$env:BROWSER_USE_NATIVE_WINDOWS_SSE_HOST = "0.0.0.0"
$env:BROWSER_USE_NATIVE_WINDOWS_SSE_PORT = "7331"
$env:BROWSER_USE_NATIVE_WINDOWS_SSE_AUTH = "change.me"
node <package-root>\dist\index.js --transport sse
```

Connect a client:

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

Change `BROWSER_USE_NATIVE_WINDOWS_SSE_AUTH` before exposing the server beyond local testing.

## Tools

- `browser_observe`: adopt or launch the browser, optionally handle a target URL through native address-bar input, and return a browser-window or browser-owned file-dialog observation.
- `browser_act`: execute one native action against a matching fresh observation token.
- `browser_status`: return transport, driver, browser process, HWND, focus, monitor, DPI, and observation state.
- `browser_stop`: release held input state and optionally close the tracked browser when requested.

## Force Stop Hotkey

Default global hotkey:

```text
Control+F12
```

The hotkey is registered by a watchdog process. When pressed, it releases virtual keys and mouse buttons, then force-kills the MCP process. Use it when native input gets stuck and the agent cannot call `browser_stop`.

## Rare Host Overrides

Normal stdio usage needs no env object.

| Key | Default | Purpose |
| --- | --- | --- |
| `BROWSER_USE_NATIVE_WINDOWS_SSE_HOST` | `127.0.0.1` | SSE bind host. |
| `BROWSER_USE_NATIVE_WINDOWS_SSE_PORT` | `7331` | SSE bind port. |
| `BROWSER_USE_NATIVE_WINDOWS_SSE_AUTH` | `change.me` | SSE bearer token. |
| `BROWSER_USE_NATIVE_WINDOWS_BROWSER_EXECUTABLE_PATH` | empty | Override browser executable auto-detection. |
| `BROWSER_USE_NATIVE_WINDOWS_BROWSER_USER_DATA_DIR` | empty | Override package-local browser profile directory. |
| `BROWSER_USE_NATIVE_WINDOWS_BROWSER_EXTRA_ARGS` | empty | Extra launch args separated by spaces. |
| `BROWSER_USE_NATIVE_WINDOWS_NO_SANDBOX` | `false` | Add browser no-sandbox launch args. |
| `BROWSER_USE_NATIVE_WINDOWS_BLOCKED_URL_RULES` | empty | Semicolon-separated wildcard URL/path block rules. |
| `BROWSER_USE_NATIVE_WINDOWS_FORCE_STOP_HOTKEY` | `Control+F12` | Override the global force-stop hotkey. |
| `BROWSER_USE_NATIVE_WINDOWS_DISABLE_FORCE_STOP_HOTKEY` | `false` | Disable the force-stop watchdog when true. |
