//go:build linux

// Package linux implements the agent's OS-facing ports (domain.WindowInspector,
// domain.IdleDetector, domain.ScreenshotCapturer, domain.SystemInfo,
// domain.ServiceController) for Ubuntu/X11.
//
// These shell out to standard X11 userspace tools (xdotool, xprintidle,
// ImageMagick's `import`) rather than linking an X11 client library
// directly, trading a small amount of per-call process-spawn overhead for
// zero cgo/X11-header build dependencies. See
// docs/architecture/05-desktop-agent-architecture.md §5.6 for the
// Wayland caveat: these tools only work in an X11 (or XWayland) session.
package linux

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

type WindowInspector struct{}

func NewWindowInspector() *WindowInspector {
	return &WindowInspector{}
}

func (w *WindowInspector) ActiveWindow() (string, string, error) {
	title, err := runTrim("xdotool", "getactivewindow", "getwindowname")
	if err != nil {
		return "", "", fmt.Errorf("xdotool getwindowname: %w", err)
	}

	pidStr, err := runTrim("xdotool", "getactivewindow", "getwindowpid")
	if err != nil {
		return "", title, fmt.Errorf("xdotool getwindowpid: %w", err)
	}
	pid, err := strconv.Atoi(pidStr)
	if err != nil {
		return "", title, fmt.Errorf("parse window pid: %w", err)
	}

	appName, err := processName(pid)
	if err != nil {
		return "", title, fmt.Errorf("resolve process name for pid %d: %w", pid, err)
	}

	return appName, title, nil
}

func processName(pid int) (string, error) {
	data, err := os.ReadFile(fmt.Sprintf("/proc/%d/comm", pid))
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func runTrim(name string, args ...string) (string, error) {
	out, err := exec.Command(name, args...).Output()
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(out)), nil
}
