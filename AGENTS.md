# browser-use-native-windows Agent Rules

- This package is standalone.
- Do not import from internal project packages, including `@repo/*`.
- Do not import from browser-control or computer-control.
- Do not use CDP, Chrome DevTools, Playwright, Puppeteer, browser extensions, DOM scripting, or page evaluation.
- Development source files must be TypeScript `.ts` files.
- Local TypeScript imports must be extensionless.
- All MCP prompt text must live under `src/prompts`.
- Prompt sections must be named exported variables using template literals.
- Do not build prompt markdown with arrays, `.join`, or `\n` chains.
- Stdio mode must write diagnostics only to stderr.
- Code files must stay under 300 lines.

## mouse
- it must never ever spawn the mouse pointer to target position, only move from current position to target position is allowed.
- before each click agent must verify and make sure the mouse is on correct location 

## keyboard
- agent must type not programatically add any value.

## browser
- this project must work with any browser and no specific browser must be hardcoded

