//go:build windows

package windows

import (
	"fmt"
	"os/exec"
)

const serviceName = "TrackerAgent"

// ServiceController reconfigures the Windows Service's binary path to
// point at the newly staged, checksum-verified executable, then stops and
// restarts it — the Windows analog of the Linux symlink-swap-and-restart
// pattern in docs/architecture/05-desktop-agent-architecture.md §5.8.
type ServiceController struct{}

func NewServiceController() *ServiceController {
	return &ServiceController{}
}

func (s *ServiceController) RestartWithBinary(stagedPath string) error {
	if err := exec.Command("sc.exe", "config", serviceName, "binPath=", stagedPath).Run(); err != nil {
		return fmt.Errorf("sc.exe config: %w", err)
	}
	if err := exec.Command("sc.exe", "stop", serviceName).Run(); err != nil {
		return fmt.Errorf("sc.exe stop: %w", err)
	}
	if err := exec.Command("sc.exe", "start", serviceName).Run(); err != nil {
		return fmt.Errorf("sc.exe start: %w", err)
	}
	return nil
}
