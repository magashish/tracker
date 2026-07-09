//go:build windows

// Package windows implements the agent's OS-facing ports for Windows
// 10/11 using raw Win32 API calls via golang.org/x/sys/windows — no cgo,
// so the agent stays a single static .exe.
package windows

import (
	"fmt"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	user32   = windows.NewLazySystemDLL("user32.dll")
	kernel32 = windows.NewLazySystemDLL("kernel32.dll")

	procGetForegroundWindow        = user32.NewProc("GetForegroundWindow")
	procGetWindowTextW             = user32.NewProc("GetWindowTextW")
	procGetWindowThreadProcessId   = user32.NewProc("GetWindowThreadProcessId")
	procOpenProcess                = kernel32.NewProc("OpenProcess")
	procQueryFullProcessImageNameW = kernel32.NewProc("QueryFullProcessImageNameW")
	procCloseHandle                = kernel32.NewProc("CloseHandle")
)

const (
	processQueryLimitedInformation = 0x1000
)

type WindowInspector struct{}

func NewWindowInspector() *WindowInspector {
	return &WindowInspector{}
}

func (w *WindowInspector) ActiveWindow() (string, string, error) {
	hwnd, _, _ := procGetForegroundWindow.Call()
	if hwnd == 0 {
		return "", "", fmt.Errorf("no foreground window")
	}

	title, err := windowText(hwnd)
	if err != nil {
		return "", "", fmt.Errorf("get window title: %w", err)
	}

	var pid uint32
	procGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&pid)))

	appName, err := processImageName(pid)
	if err != nil {
		return "", title, fmt.Errorf("resolve process image name for pid %d: %w", pid, err)
	}

	return appName, title, nil
}

func windowText(hwnd uintptr) (string, error) {
	buf := make([]uint16, 512)
	n, _, _ := procGetWindowTextW.Call(hwnd, uintptr(unsafe.Pointer(&buf[0])), uintptr(len(buf)))
	if n == 0 {
		return "", nil // untitled window is not an error
	}
	return syscall.UTF16ToString(buf[:n]), nil
}

func processImageName(pid uint32) (string, error) {
	handle, _, err := procOpenProcess.Call(processQueryLimitedInformation, 0, uintptr(pid))
	if handle == 0 {
		return "", fmt.Errorf("OpenProcess: %w", err)
	}
	defer procCloseHandle.Call(handle)

	buf := make([]uint16, windows.MAX_PATH)
	size := uint32(len(buf))
	ret, _, err := procQueryFullProcessImageNameW.Call(
		handle, 0, uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)),
	)
	if ret == 0 {
		return "", fmt.Errorf("QueryFullProcessImageName: %w", err)
	}
	fullPath := syscall.UTF16ToString(buf[:size])
	return strings.TrimSuffix(filepath.Base(fullPath), filepath.Ext(fullPath)), nil
}
