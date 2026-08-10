import type { ServerConfig } from '../config';
import type { RuntimeState } from '../state';
import { getNativeInputController } from '../native/input/controller';
import { findWindowsBrowserWindow, getForegroundWindowHandle, listDisplays } from '../native/windowsWindow';

const processState = (state: RuntimeState) => {
  const proc = state.browser?.proc;
  return proc
    ? { killed: proc.killed, exitCode: proc.exitCode, signalCode: proc.signalCode }
    : null;
};

export const browserStatus = async (state: RuntimeState, config: ServerConfig) => {
  const browserWindow = state.browser
    ? await findWindowsBrowserWindow({
        handle: state.browser.windowHandle,
        pid: state.browser.windowProcessId,
        executablePath: state.browser.exe.path,
      })
    : null;
  const displays = browserWindow ? await listDisplays() : [];
  const monitorIndex = browserWindow?.monitor
    ? displays.findIndex((display) => display.id === browserWindow.monitor?.id)
    : -1;
  const isBrowserForeground = !!browserWindow && await getForegroundWindowHandle() === browserWindow.handle;
  const last = state.lastObservation;
  const driver = getNativeInputController().driverStatus();
  state.browserWindow = browserWindow ? { handle: browserWindow.handle } : null;
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
    browserWindow,
    focus: {
      isBrowserForeground,
    },
    observedTargetType: last?.observedTargetType || null,
    monitorIndex: monitorIndex >= 0 ? monitorIndex : null,
    monitor: browserWindow?.monitor || null,
    dpi: browserWindow?.monitor?.dpi || browserWindow?.dpi || null,
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
