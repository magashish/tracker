//go:build windows

package windows

type SystemInfo struct{}

func NewSystemInfo() *SystemInfo {
	return &SystemInfo{}
}

func (s *SystemInfo) UptimeSeconds() (int, error) {
	ticks, _, _ := procGetTickCount64.Call()
	return int(ticks / 1000), nil
}
