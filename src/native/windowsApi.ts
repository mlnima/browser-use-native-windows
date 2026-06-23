export const escapePs = (value: string) =>
  value.replaceAll("'", "''");

export const windowsApiSource = `
using System;
using System.Text;
using System.Runtime.InteropServices;
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public struct POINT { public int X; public int Y; }
[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)]
public struct MONITORINFOEX {
  public int cbSize;
  public RECT rcMonitor;
  public RECT rcWork;
  public int dwFlags;
  [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string szDevice;
}
public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
public static class NativeBrowserUseApi {
  const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
  const int GWL_EXSTYLE = -20;
  const long WS_EX_TOOLWINDOW = 0x00000080L;
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc proc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hWnd, uint command);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT point);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFOEX info);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hWnd, int attr, out RECT rect, int size);
  [DllImport("user32.dll", EntryPoint="GetWindowLongPtr")] static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int index);
  [DllImport("user32.dll", EntryPoint="GetWindowLong")] static extern IntPtr GetWindowLongPtr32(IntPtr hWnd, int index);
  public static void EnableDpiAwareness() { try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { SetProcessDPIAware(); } }
  public static IntPtr ReadWindowLongPtr(IntPtr hWnd, int index) { return IntPtr.Size == 8 ? GetWindowLongPtr64(hWnd, index) : GetWindowLongPtr32(hWnd, index); }
  public static bool IsToolWindow(IntPtr hWnd) { return (ReadWindowLongPtr(hWnd, GWL_EXSTYLE).ToInt64() & WS_EX_TOOLWINDOW) != 0; }
  public static RECT ReadFrameRect(IntPtr hWnd) { RECT rect; if (DwmGetWindowAttribute(hWnd, DWMWA_EXTENDED_FRAME_BOUNDS, out rect, Marshal.SizeOf(typeof(RECT))) != 0) GetWindowRect(hWnd, out rect); return rect; }
  public static RECT ReadClientRect(IntPtr hWnd) { RECT rect; GetClientRect(hWnd, out rect); POINT a = new POINT { X = rect.Left, Y = rect.Top }; POINT b = new POINT { X = rect.Right, Y = rect.Bottom }; ClientToScreen(hWnd, ref a); ClientToScreen(hWnd, ref b); return new RECT { Left = a.X, Top = a.Y, Right = b.X, Bottom = b.Y }; }
  public static MONITORINFOEX ReadMonitorInfo(IntPtr monitor) { MONITORINFOEX info = new MONITORINFOEX(); info.cbSize = Marshal.SizeOf(typeof(MONITORINFOEX)); GetMonitorInfo(monitor, ref info); return info; }
  public static uint ReadDpi(IntPtr hWnd) { try { return GetDpiForWindow(hWnd); } catch { return 96; } }
  public static void BringToTop(IntPtr hWnd) { BringWindowToTop(hWnd); SetForegroundWindow(hWnd); }
}
`;

export const apiPrelude = () =>
  `Add-Type -TypeDefinition '${escapePs(windowsApiSource)}'
[NativeBrowserUseApi]::EnableDpiAwareness()`;

export const boundsObject = (name: string) =>
  `[PSCustomObject]@{left=[int]$${name}.Left;top=[int]$${name}.Top;right=[int]$${name}.Right;bottom=[int]$${name}.Bottom}`;
