//go:build windows

package windows

import (
	"context"
	"time"

	"golang.org/x/sys/windows/svc"
)

// ServiceHandler adapts the agent's context-cancellation-based lifecycle
// to the Windows Service Control Manager's svc.Handler interface, so
// `sc.exe start TrackerAgent` (installed by the NSIS installer with
// SERVICE_AUTO_START, per docs/architecture/05-desktop-agent-architecture.md
// §5.6) runs the same Run function as a normal process.
type ServiceHandler struct {
	Run func(ctx context.Context)
}

func (h *ServiceHandler) Execute(_ []string, requests <-chan svc.ChangeRequest, changes chan<- svc.Status) (bool, uint32) {
	changes <- svc.Status{State: svc.StartPending}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	done := make(chan struct{})
	go func() {
		h.Run(ctx)
		close(done)
	}()

	changes <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}

	for {
		select {
		case req := <-requests:
			switch req.Cmd {
			case svc.Interrogate:
				changes <- req.CurrentStatus
			case svc.Stop, svc.Shutdown:
				changes <- svc.Status{State: svc.StopPending}
				cancel()
				select {
				case <-done:
				case <-time.After(10 * time.Second):
				}
				changes <- svc.Status{State: svc.Stopped}
				return false, 0
			}
		case <-done:
			changes <- svc.Status{State: svc.Stopped}
			return false, 0
		}
	}
}

// RunAsService blocks for the lifetime of the service.
func RunAsService(name string, run func(ctx context.Context)) error {
	return svc.Run(name, &ServiceHandler{Run: run})
}

// IsWindowsService reports whether the process was started by the SCM
// (vs. run interactively, e.g. during development).
func IsWindowsService() (bool, error) {
	return svc.IsWindowsService()
}
