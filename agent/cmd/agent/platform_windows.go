//go:build windows

package main

import (
	"context"

	"github.com/tracker/agent/internal/domain"
	winplatform "github.com/tracker/agent/internal/infrastructure/platform/windows"
)

type platformAdapters struct {
	Windows    domain.WindowInspector
	Idle       domain.IdleDetector
	Screenshot domain.ScreenshotCapturer
	SysInfo    domain.SystemInfo
	Service    domain.ServiceController
}

func newPlatformAdapters(_ string) platformAdapters {
	return platformAdapters{
		Windows:    winplatform.NewWindowInspector(),
		Idle:       winplatform.NewIdleDetector(),
		Screenshot: winplatform.NewScreenshotCapturer(),
		SysInfo:    winplatform.NewSystemInfo(),
		Service:    winplatform.NewServiceController(),
	}
}

// runService hands control to the Windows Service Control Manager when
// running as an installed service; when run interactively (e.g. `go run`
// during development) it just calls run directly.
func runService(run func(ctx context.Context)) {
	if isRunningAsService() {
		_ = winplatform.RunAsService("TrackerAgent", run)
		return
	}
	run(context.Background())
}

func isRunningAsService() bool {
	isService, err := winplatform.IsWindowsService()
	return err == nil && isService
}
