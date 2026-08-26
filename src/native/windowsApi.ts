export const escapePs = (value: string) =>
  value.replaceAll("'", "''");

export const windowsApiSource = `
using System;
using System.Text;
using System.Runtime.InteropServices;
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public struct POINT { public int X; public int Y; }
[StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
[StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public UIntPtr dwExtraInfo; }
[StructLayout(LayoutKind.Explicit)] public struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
[StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INPUTUNION data; }
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
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern IntPtr GetThreadDpiAwarenessContext();
  [DllImport("user32.dll")] public static extern int GetAwarenessFromDpiAwarenessContext(IntPtr value);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc proc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr GetWindow(IntPtr hWnd, uint command);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT point);
  [DllImport("user32.dll", EntryPoint="GetPhysicalCursorPos")] static extern bool ReadPhysicalCursor(out POINT point);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT point);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);
  [DllImport("user32.dll")] public static extern IntPtr MonitorFromPoint(POINT point, uint flags);
  [DllImport("user32.dll", CharSet=CharSet.Auto)] public static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFOEX info);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint source, uint target, bool attach);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int command);
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint count, INPUT[] inputs, int size);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
  [DllImport("dwmapi.dll")] public static extern int DwmGetWindowAttribute(IntPtr hWnd, int attr, out RECT rect, int size);
  [DllImport("shcore.dll")] public static extern int GetScaleFactorForMonitor(IntPtr monitor, out int scale);
  [DllImport("user32.dll", EntryPoint="GetWindowLongPtr")] static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int index);
  [DllImport("user32.dll", EntryPoint="GetWindowLong")] static extern IntPtr GetWindowLongPtr32(IntPtr hWnd, int index);
  public static void EnableDpiAwareness() {
    try { SetProcessDpiAwarenessContext(new IntPtr(-4)); SetThreadDpiAwarenessContext(new IntPtr(-4)); }
    catch { try { SetProcessDPIAware(); } catch {} }
    try { if (GetAwarenessFromDpiAwarenessContext(GetThreadDpiAwarenessContext()) < 2) throw new InvalidOperationException("Per-monitor DPI awareness is required."); }
    catch (EntryPointNotFoundException) { throw new InvalidOperationException("Per-monitor DPI awareness is not supported by this Windows version."); }
  }
  public static IntPtr ReadWindowLongPtr(IntPtr hWnd, int index) { return IntPtr.Size == 8 ? GetWindowLongPtr64(hWnd, index) : GetWindowLongPtr32(hWnd, index); }
  public static bool IsToolWindow(IntPtr hWnd) { return (ReadWindowLongPtr(hWnd, GWL_EXSTYLE).ToInt64() & WS_EX_TOOLWINDOW) != 0; }
  public static RECT ReadFrameRect(IntPtr hWnd) { RECT rect; if (DwmGetWindowAttribute(hWnd, DWMWA_EXTENDED_FRAME_BOUNDS, out rect, Marshal.SizeOf(typeof(RECT))) != 0 && !GetWindowRect(hWnd, out rect)) throw new InvalidOperationException("Window bounds are unavailable."); return rect; }
  public static RECT ReadClientRect(IntPtr hWnd) { RECT rect; if (!GetClientRect(hWnd, out rect)) throw new InvalidOperationException("Client bounds are unavailable."); POINT a = new POINT { X = rect.Left, Y = rect.Top }; POINT b = new POINT { X = rect.Right, Y = rect.Bottom }; if (!ClientToScreen(hWnd, ref a) || !ClientToScreen(hWnd, ref b)) throw new InvalidOperationException("Client screen coordinates are unavailable."); return new RECT { Left = a.X, Top = a.Y, Right = b.X, Bottom = b.Y }; }
  public static MONITORINFOEX ReadMonitorInfo(IntPtr monitor) { MONITORINFOEX info = new MONITORINFOEX(); info.cbSize = Marshal.SizeOf(typeof(MONITORINFOEX)); if (!GetMonitorInfo(monitor, ref info)) throw new InvalidOperationException("Monitor information is unavailable."); return info; }
  public static uint ReadDpi(IntPtr hWnd) { uint dpi = GetDpiForWindow(hWnd); if (dpi == 0) throw new InvalidOperationException("Window DPI is unavailable."); return dpi; }
  public static int ReadMonitorScale(IntPtr monitor) { int scale; if (GetScaleFactorForMonitor(monitor, out scale) != 0 || scale <= 0) throw new InvalidOperationException("Monitor scale is unavailable."); return scale; }
  public static bool GetCursorPos(out POINT point) { if (!ReadPhysicalCursor(out point)) throw new InvalidOperationException("Physical cursor position is unavailable."); return true; }
  public static void SendMouse(int x, int y, int data, uint flags) {
    INPUT input = new INPUT { type = 0, data = new INPUTUNION { mi = new MOUSEINPUT { dx = x, dy = y, mouseData = unchecked((uint)data), dwFlags = flags } } };
    if (SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT))) != 1) throw new InvalidOperationException("Native mouse input failed.");
  }
  static double Approach(double value, double target, double amount) {
    if (value < target) return Math.Min(value + amount, target);
    return Math.Max(value - amount, target);
  }
  static void RequireDesktopPoint(int x, int y) {
    int left = GetSystemMetrics(76); int top = GetSystemMetrics(77);
    int width = GetSystemMetrics(78); int height = GetSystemMetrics(79);
    if (width <= 0 || height <= 0 || x < left || y < top || x >= (long)left + width || y >= (long)top + height) {
      throw new InvalidOperationException("Native cursor target is outside the current virtual desktop.");
    }
  }
  public static int MoveCursor(int targetX, int targetY) {
    RequireDesktopPoint(targetX, targetY);
    POINT point; GetCursorPos(out point);
    double velocityX = 0; double velocityY = 0; double driftX = 0; double driftY = 0;
    int unchanged = 0;
    Random random = new Random(unchecked(Environment.TickCount * 397) ^ targetX ^ targetY);
    for (int step = 0; step < 2400; step++) {
      int dx = targetX - point.X; int dy = targetY - point.Y;
      if (dx == 0 && dy == 0) return step;
      double distance = Math.Sqrt((double)dx * dx + (double)dy * dy);
      int moveX; int moveY;
      if (distance <= 12) {
        velocityX = 0; velocityY = 0;
        int correction = Math.Min(3, 1 + unchanged / 5);
        moveX = Math.Sign(dx) * Math.Min(Math.Abs(dx), correction);
        moveY = Math.Sign(dy) * Math.Min(Math.Abs(dy), correction);
      } else {
        double speed = Math.Min(46, Math.Sqrt(distance * 7.5));
        double drift = Math.Min(1, distance / 180);
        driftX = driftX * 0.86 + (random.NextDouble() - 0.5) * 0.7 * drift;
        driftY = driftY * 0.86 + (random.NextDouble() - 0.5) * 0.7 * drift;
        double desiredX = dx / distance * speed + driftX;
        double desiredY = dy / distance * speed + driftY;
        velocityX = Approach(velocityX, desiredX, 3.4);
        velocityY = Approach(velocityY, desiredY, 3.4);
        moveX = Math.Sign(dx) * Math.Min(Math.Abs(dx), Math.Max(1, Math.Abs((int)Math.Round(velocityX))));
        moveY = Math.Sign(dy) * Math.Min(Math.Abs(dy), Math.Max(1, Math.Abs((int)Math.Round(velocityY))));
      }
      POINT before = point;
      SendMouse(moveX, moveY, 0, 0x2001);
      System.Threading.Thread.Sleep(random.Next(5, 10));
      GetCursorPos(out point);
      unchanged = point.X == before.X && point.Y == before.Y ? unchanged + 1 : 0;
      if (unchanged >= 30) throw new InvalidOperationException("Native cursor did not respond to relative movement.");
    }
    throw new InvalidOperationException("Native cursor did not reach the target within the movement limit.");
  }
  public static void ClickMouseAt(int x, int y, uint down, uint up, int holdMs) {
    POINT point; GetCursorPos(out point);
    if (point.X != x || point.Y != y) throw new InvalidOperationException("Native cursor moved before click.");
    SendMouse(0, 0, 0, down);
    try {
      System.Threading.Thread.Sleep(Math.Max(1, holdMs));
      GetCursorPos(out point);
      if (point.X != x || point.Y != y) throw new InvalidOperationException("Native cursor moved while clicking.");
    } finally { SendMouse(0, 0, 0, up); }
  }
  public static void ScrollMouseAt(int x, int y, int delta) {
    POINT point; GetCursorPos(out point);
    if (point.X != x || point.Y != y) throw new InvalidOperationException("Native cursor moved before wheel scroll.");
    SendMouse(0, 0, delta, 0x0800);
  }
  public static bool OwnsPoint(IntPtr target, int x, int y) { POINT point = new POINT { X = x, Y = y }; IntPtr hit = WindowFromPoint(point); return hit != IntPtr.Zero && GetAncestor(hit, 2) == target; }
  public static void SendScanCode(int code, bool up, bool extended) {
    uint flags = 0x0008 | (up ? 0x0002u : 0u) | (extended ? 0x0001u : 0u);
    INPUT input = new INPUT { type = 1, data = new INPUTUNION { ki = new KEYBDINPUT { wScan = (ushort)code, dwFlags = flags } } };
    if (SendInput(1, new INPUT[] { input }, Marshal.SizeOf(typeof(INPUT))) != 1) throw new InvalidOperationException("Native keyboard input failed.");
  }
  public static void SendUnicodeText(string text) {
    foreach (char character in text) {
      INPUT down = new INPUT { type = 1, data = new INPUTUNION { ki = new KEYBDINPUT { wScan = character, dwFlags = 0x0004 } } };
      INPUT up = new INPUT { type = 1, data = new INPUTUNION { ki = new KEYBDINPUT { wScan = character, dwFlags = 0x0006 } } };
      if (SendInput(2, new INPUT[] { down, up }, Marshal.SizeOf(typeof(INPUT))) != 2) throw new InvalidOperationException("Native Unicode keyboard input failed.");
    }
  }
  public static bool BringToTop(IntPtr hWnd) {
    if (IsIconic(hWnd)) ShowWindowAsync(hWnd, 9);
    IntPtr foreground = GetForegroundWindow(); uint ignored;
    uint currentThread = GetCurrentThreadId();
    uint foregroundThread = foreground == IntPtr.Zero ? 0 : GetWindowThreadProcessId(foreground, out ignored);
    uint targetThread = GetWindowThreadProcessId(hWnd, out ignored);
    bool foregroundAttached = foregroundThread != 0 && foregroundThread != currentThread && AttachThreadInput(currentThread, foregroundThread, true);
    bool targetAttached = targetThread != 0 && targetThread != currentThread && AttachThreadInput(currentThread, targetThread, true);
    try { BringWindowToTop(hWnd); SetForegroundWindow(hWnd); return GetForegroundWindow() == hWnd; }
    finally {
      if (targetAttached) AttachThreadInput(currentThread, targetThread, false);
      if (foregroundAttached) AttachThreadInput(currentThread, foregroundThread, false);
    }
  }
}
`;

export const apiPrelude = () =>
  `Add-Type -TypeDefinition '${escapePs(windowsApiSource)}'
[NativeBrowserUseApi]::EnableDpiAwareness()`;

export const boundsObject = (name: string) =>
  `[PSCustomObject]@{left=[int]$${name}.Left;top=[int]$${name}.Top;right=[int]$${name}.Right;bottom=[int]$${name}.Bottom}`;
