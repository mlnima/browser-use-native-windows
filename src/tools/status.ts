import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { getNativeInputController } from '../native/input/controller';
import { getForegroundWindow } from '../native/windowsWindow';

const processState = (state: RuntimeState) => {
  const proc = state.browser?.proc;
  return proc
    ? { killed: proc.killed, exitCode: proc.exitCode, signalCode: proc.signalCode }
    : null;
};

export const browserStatus = async (state: RuntimeState, config: ServerConfig) => {
  const foreground = await getForegroundWindow();
  const last = state.lastObservation;
  const driver = getNativeInputController().driverStatus();
  return {
    transport: state.transportMode,
    nativeInputDriver: driver,
    running: !!state.browser,
    browserPid: state.browser?.pid ?? null,
    launchedByMcp: state.browser?.launchedByMcp ?? null,
    browserKind: state.browser?.exe.kind ?? null,
    browserExecutablePath: state.browser?.exe.path || config.browserExecutablePath || null,
    browserExecutableDetectionError: state.browser ? null : state.lastError,
    userDataDir: state.browser?.userDataDir || config.browserUserDataDir,
    browserLaunchArgs: state.browser?.args || [],
    browserProcessState: processState(state),
    browserWindow: state.browserWindow,
    foregroundWindow: foreground,
    focus: {
      isBrowserForeground: !!foreground && !!state.browserWindow && foreground.handle === state.browserWindow.handle,
      foregroundHandle: foreground?.handle || null,
    },
    observedTargetType: last?.observedTargetType || null,
    observedTargetWindow: last?.target || null,
    monitorIndex: last?.screenshot.monitorIndex ?? null,
    monitor: last?.screenshot.monitor ?? null,
    dpi: last?.screenshot.dpi ?? null,
    lastObservation: last
      ? {
          token: last.observationToken,
          capturedAt: last.capturedAt,
          consumed: last.consumed,
          stale: last.stale,
        }
      : null,
    lastError: state.lastError,
  };
};
