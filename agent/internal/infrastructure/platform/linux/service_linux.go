//go:build linux

package linux

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

const serviceName = "tracker-agent"

// ServiceController swaps the "current" symlink to the newly staged
// binary and asks the user-level systemd unit to restart, per the
// versioned-directory + symlink-swap pattern in
// docs/architecture/05-desktop-agent-architecture.md §5.8.
type ServiceController struct {
	installDir string // directory containing the "current" symlink
}

func NewServiceController(installDir string) *ServiceController {
	return &ServiceController{installDir: installDir}
}

func (s *ServiceController) RestartWithBinary(stagedPath string) error {
	currentLink := filepath.Join(s.installDir, "current")
	tmpLink := currentLink + ".tmp"

	if err := os.Symlink(stagedPath, tmpLink); err != nil {
		return fmt.Errorf("create symlink to staged binary: %w", err)
	}
	if err := os.Rename(tmpLink, currentLink); err != nil {
		return fmt.Errorf("atomically swap current-version symlink: %w", err)
	}

	if err := exec.Command("systemctl", "--user", "restart", serviceName).Run(); err != nil {
		return fmt.Errorf("systemctl --user restart %s: %w", serviceName, err)
	}
	return nil
}
