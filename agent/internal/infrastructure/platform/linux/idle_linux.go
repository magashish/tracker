//go:build linux

package linux

import (
	"fmt"
	"os/exec"
	"strconv"
	"strings"
)

type IdleDetector struct{}

func NewIdleDetector() *IdleDetector {
	return &IdleDetector{}
}

// IdleSeconds shells out to xprintidle (X11 idle time in milliseconds).
// If the tool isn't installed (e.g. a headless/Wayland session where the
// X11 idle extension isn't available), it degrades to "always active"
// (0 idle seconds) rather than failing the whole heartbeat tick.
func (d *IdleDetector) IdleSeconds() (int, error) {
	out, err := exec.Command("xprintidle").Output()
	if err != nil {
		if _, notFound := err.(*exec.Error); notFound {
			return 0, nil
		}
		return 0, fmt.Errorf("xprintidle: %w", err)
	}
	ms, err := strconv.Atoi(strings.TrimSpace(string(out)))
	if err != nil {
		return 0, fmt.Errorf("parse xprintidle output: %w", err)
	}
	return ms / 1000, nil
}
