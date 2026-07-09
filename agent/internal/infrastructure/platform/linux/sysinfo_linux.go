//go:build linux

package linux

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

type SystemInfo struct{}

func NewSystemInfo() *SystemInfo {
	return &SystemInfo{}
}

func (s *SystemInfo) UptimeSeconds() (int, error) {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0, fmt.Errorf("read /proc/uptime: %w", err)
	}
	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return 0, fmt.Errorf("unexpected /proc/uptime format")
	}
	uptime, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, fmt.Errorf("parse /proc/uptime: %w", err)
	}
	return int(uptime), nil
}
