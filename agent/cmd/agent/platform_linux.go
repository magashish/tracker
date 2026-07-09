//go:build linux

package main

import (
	"context"

	"github.com/tracker/agent/internal/domain"
	linuxplatform "github.com/tracker/agent/internal/infrastructure/platform/linux"
)

type platformAdapters struct {
	Windows    domain.WindowInspector
	Idle       domain.IdleDetector
	Screenshot domain.ScreenshotCapturer
	SysInfo    domain.SystemInfo
	Service    domain.ServiceController
}

func newPlatformAdapters(installDir string) platformAdapters {
	return platformAdapters{
		Windows:    linuxplatform.NewWindowInspector(),
		Idle:       linuxplatform.NewIdleDetector(),
		Screenshot: linuxplatform.NewScreenshotCapturer(),
		SysInfo:    linuxplatform.NewSystemInfo(),
		Service:    linuxplatform.NewServiceController(installDir),
	}
}

// runService is a no-op wrapper on Linux: systemd already manages the
// process lifecycle (start/restart/stop) directly, so there is no
// in-process SCM handshake to perform the way Windows requires.
func runService(run func(ctx context.Context)) {
	run(context.Background())
}

func isRunningAsService() bool {
	return false
}
