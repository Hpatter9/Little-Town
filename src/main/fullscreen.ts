// Detects a fullscreen app (game, video, presentation) on the strip's monitor, via Win32.
// A window counts as fullscreen when it is in the foreground and covers its whole monitor, taskbar included.
// Maximized windows only cover the work area, so they don't count.

import koffi from 'koffi';

const user32 = koffi.load('user32.dll');
const RECT = koffi.struct('RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
const MONITORINFO = koffi.struct('MONITORINFO', { cbSize: 'uint32', rcMonitor: RECT, rcWork: RECT, dwFlags: 'uint32' });

const GetForegroundWindow = user32.func('void* __stdcall GetForegroundWindow()');
const GetWindowRect = user32.func('bool __stdcall GetWindowRect(void* hWnd, _Out_ RECT* lpRect)');
const MonitorFromWindow = user32.func('void* __stdcall MonitorFromWindow(void* hWnd, uint32 dwFlags)');
const GetMonitorInfoW = user32.func('bool __stdcall GetMonitorInfoW(void* hMonitor, _Inout_ MONITORINFO* lpmi)');
const GetClassNameW = user32.func('int __stdcall GetClassNameW(void* hWnd, _Out_ uint16_t* lpClassName, int nMaxCount)');
const GetWindowLongW = user32.func('int32 __stdcall GetWindowLongW(void* hWnd, int nIndex)');

const MONITOR_DEFAULTTONEAREST = 2;
const GWL_STYLE = -16;
const WS_CAPTION = 0x00c00000;
/**
 * The desktop, taskbar and shell surfaces (lock screen and other system UI use CoreWindow) also cover the
 * monitor, but they are not fullscreen apps. Fullscreen UWP apps use ApplicationFrameWindow, so they still count.
 */
const SHELL_CLASSES = new Set(['Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd', 'Windows.UI.Core.CoreWindow']);

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** HWND of a BrowserWindow, as the numeric address koffi reports for pointers. */
export function hwndAddress(nativeHandle: Buffer): bigint {
  return nativeHandle.length >= 8 ? nativeHandle.readBigUInt64LE(0) : BigInt(nativeHandle.readUInt32LE(0));
}

/**
 * True when the foreground window is fullscreen on the same monitor as `stripHandle`.
 * `ownWindows` are ignored (the strip and its panels are never "a fullscreen app").
 */
export function fullscreenAppOnMonitorOf(stripHandle: Buffer, ownWindows: bigint[]): boolean {
  try {
    const fg = GetForegroundWindow();
    if (!fg) return false;
    if (ownWindows.includes(koffi.address(fg))) return false;

    const cls = Buffer.alloc(512);
    const n = GetClassNameW(fg, cls, 256);
    if (SHELL_CLASSES.has(cls.toString('utf16le', 0, n * 2))) return false;
    // With an auto-hiding taskbar a maximized window also covers the monitor; fullscreen apps drop the title bar.
    if ((GetWindowLongW(fg, GWL_STYLE) & WS_CAPTION) === WS_CAPTION) return false;

    const fgMonitor = MonitorFromWindow(fg, MONITOR_DEFAULTTONEAREST);
    const stripMonitor = MonitorFromWindow(hwndAddressPointer(stripHandle), MONITOR_DEFAULTTONEAREST);
    if (!fgMonitor || !stripMonitor || koffi.address(fgMonitor) !== koffi.address(stripMonitor)) return false;

    const empty = (): Rect => ({ left: 0, top: 0, right: 0, bottom: 0 });
    const info = { cbSize: koffi.sizeof(MONITORINFO), rcMonitor: empty(), rcWork: empty(), dwFlags: 0 };
    if (!GetMonitorInfoW(fgMonitor, info)) return false;
    const r = empty();
    if (!GetWindowRect(fg, r)) return false;
    const m = info.rcMonitor;
    return r.left <= m.left && r.top <= m.top && r.right >= m.right && r.bottom >= m.bottom;
  } catch (err) {
    console.error('fullscreen check failed', err);
    return false;
  }
}

/** Electron gives the HWND as a buffer holding the handle; read it back out as a pointer. */
function hwndAddressPointer(nativeHandle: Buffer): unknown {
  return koffi.decode(nativeHandle, 'void*');
}
