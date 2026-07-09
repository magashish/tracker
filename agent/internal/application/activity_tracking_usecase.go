package application

import (
	"sync"
	"time"

	"github.com/tracker/agent/internal/domain"
)

// ActivityTrackingUseCase samples the active window/idle state on a short
// local tick (default 5s) and aggregates it in memory into active/idle
// second buckets, so the network/DB write rate stays at the heartbeat
// cadence (30s) rather than the sampling cadence.
type ActivityTrackingUseCase struct {
	windows domain.WindowInspector
	idle    domain.IdleDetector

	mu            sync.Mutex
	activeSeconds int
	idleSeconds   int
	lastApp       string
	lastTitle     string
}

func NewActivityTrackingUseCase(windows domain.WindowInspector, idle domain.IdleDetector) *ActivityTrackingUseCase {
	return &ActivityTrackingUseCase{windows: windows, idle: idle}
}

// Sample should be called on a short ticker (e.g. every 5s). sampleInterval
// is how much wall-clock time this sample represents.
func (u *ActivityTrackingUseCase) Sample(sampleInterval time.Duration, idleThresholdSeconds int) error {
	app, title, err := u.windows.ActiveWindow()
	if err != nil {
		return err
	}
	idleSecs, err := u.idle.IdleSeconds()
	if err != nil {
		return err
	}

	u.mu.Lock()
	defer u.mu.Unlock()

	seconds := int(sampleInterval.Seconds())
	if idleSecs >= idleThresholdSeconds {
		u.idleSeconds += seconds
	} else {
		u.activeSeconds += seconds
	}
	u.lastApp = app
	u.lastTitle = title
	return nil
}

// Flush returns the aggregated window since the last flush and resets the
// counters. Called once per heartbeat tick.
func (u *ActivityTrackingUseCase) Flush(windowStart, windowEnd time.Time) (domain.ActivitySample, bool) {
	u.mu.Lock()
	defer u.mu.Unlock()

	if u.activeSeconds == 0 && u.idleSeconds == 0 {
		return domain.ActivitySample{}, false
	}

	sample := domain.ActivitySample{
		WindowStart:   windowStart,
		WindowEnd:     windowEnd,
		AppName:       u.lastApp,
		WindowTitle:   u.lastTitle,
		ActiveSeconds: u.activeSeconds,
		IdleSeconds:   u.idleSeconds,
	}
	u.activeSeconds = 0
	u.idleSeconds = 0
	return sample, true
}

// CurrentIdleSeconds is used directly by the heartbeat payload (the API
// wants the instantaneous idle duration, not the aggregated bucket).
func (u *ActivityTrackingUseCase) CurrentIdleSeconds() (int, error) {
	return u.idle.IdleSeconds()
}

func (u *ActivityTrackingUseCase) CurrentWindow() (string, string, error) {
	return u.windows.ActiveWindow()
}
