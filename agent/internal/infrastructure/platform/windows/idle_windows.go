//go:build windows

package windows

import (
	"fmt"
	"unsafe"
)

var procGetLastInputInfo = user32.NewProc("GetLastInputInfo")
var procGetTickCount64 = kernel32.NewProc("GetTickCount64")

type lastInputInfo struct {
	cbSize uint32
	dwTime uint32
}

type IdleDetector struct{}

func NewIdleDetector() *IdleDetector {
	return &IdleDetector{}
}

// IdleSeconds computes idle time as (current tick count - last input tick)
// via GetLastInputInfo, the standard Win32 idle-detection API.
func (d *IdleDetector) IdleSeconds() (int, error) {
	info := lastInputInfo{cbSize: uint32(unsafe.Sizeof(lastInputInfo{}))}
	ret, _, err := procGetLastInputInfo.Call(uintptr(unsafe.Pointer(&info)))
	if ret == 0 {
		return 0, fmt.Errorf("GetLastInputInfo: %w", err)
	}

	nowTicks, _, _ := procGetTickCount64.Call()
	// dwTime is a 32-bit tick count (wraps ~49.7 days); GetTickCount64's
	// low 32 bits stay comparable to it over any realistic idle duration.
	idleMillis := uint32(nowTicks) - info.dwTime
	return int(idleMillis / 1000), nil
}
