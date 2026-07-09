package application

import (
	"context"
	"log/slog"
	"time"

	"github.com/tracker/agent/internal/domain"
)

const idleSampleInterval = 5 * time.Second

// Scheduler owns the three tickers described in the agent architecture
// doc (idle sampling, heartbeat, screenshot capture) plus the offline
// sync drain, and fans work out through the use cases. It is the only
// place in the codebase with goroutines/tickers — everything it calls
// is synchronous and testable on its own.
type Scheduler struct {
	auth       *AuthUseCase
	tracking   *ActivityTrackingUseCase
	heartbeat  *HeartbeatUseCase
	screenshot *ScreenshotUseCase
	sync       *SyncUseCase
	autoupdate *AutoUpdateUseCase

	config    domain.Config
	sessionID string
	log       *slog.Logger

	heartbeatTicker  *time.Ticker
	screenshotTicker *time.Ticker
	idleTicker       *time.Ticker
	updateTicker     *time.Ticker
}

func NewScheduler(
	auth *AuthUseCase,
	tracking *ActivityTrackingUseCase,
	heartbeat *HeartbeatUseCase,
	screenshot *ScreenshotUseCase,
	sync *SyncUseCase,
	autoupdate *AutoUpdateUseCase,
	initialConfig domain.Config,
	sessionID string,
	log *slog.Logger,
) *Scheduler {
	return &Scheduler{
		auth:       auth,
		tracking:   tracking,
		heartbeat:  heartbeat,
		screenshot: screenshot,
		sync:       sync,
		autoupdate: autoupdate,
		config:     initialConfig,
		sessionID:  sessionID,
		log:        log,
	}
}

// Run blocks until ctx is cancelled. Config interval changes (returned by
// the heartbeat response) call ticker.Reset rather than tearing down and
// recreating goroutines.
func (s *Scheduler) Run(ctx context.Context) {
	s.idleTicker = time.NewTicker(idleSampleInterval)
	s.heartbeatTicker = time.NewTicker(time.Duration(s.config.HeartbeatIntervalSeconds) * time.Second)
	s.screenshotTicker = time.NewTicker(time.Duration(s.config.ScreenshotIntervalSeconds) * time.Second)
	s.updateTicker = time.NewTicker(1 * time.Hour)
	defer s.idleTicker.Stop()
	defer s.heartbeatTicker.Stop()
	defer s.screenshotTicker.Stop()
	defer s.updateTicker.Stop()

	windowStart := time.Now().UTC()

	for {
		select {
		case <-ctx.Done():
			return

		case <-s.idleTicker.C:
			if err := s.tracking.Sample(idleSampleInterval, s.config.IdleThresholdSeconds); err != nil {
				s.log.Warn("idle sample failed", "error", err)
			}

		case <-s.heartbeatTicker.C:
			session := s.auth.CurrentSession()
			if session == nil {
				continue
			}
			windowEnd := time.Now().UTC()
			config, err := s.heartbeat.Execute(ctx, session, s.sessionID, windowStart, windowEnd)
			windowStart = windowEnd
			if err != nil {
				s.log.Warn("heartbeat failed, will retry sync on next tick", "error", err)
				continue
			}
			s.applyConfig(config)

			if n, err := s.sync.DrainActivity(ctx, session.AccessToken, session.Device.ID); err != nil {
				s.log.Warn("offline activity sync failed", "error", err)
			} else if n > 0 {
				s.log.Info("synced queued activity", "count", n)
			}
			if n, err := s.sync.DrainScreenshots(ctx, session.AccessToken); err != nil {
				s.log.Warn("offline screenshot sync failed", "error", err)
			} else if n > 0 {
				s.log.Info("synced queued screenshots", "count", n)
			}

		case <-s.screenshotTicker.C:
			session := s.auth.CurrentSession()
			if session == nil {
				continue
			}
			idleSecs, _ := s.tracking.CurrentIdleSeconds()
			activityPercent := 100
			if idleSecs >= s.config.IdleThresholdSeconds {
				activityPercent = 0
			}
			app, title, _ := s.tracking.CurrentWindow()
			if err := s.screenshot.CaptureAndUpload(ctx, session, s.sessionID, s.config.ScreenshotQuality, activityPercent, app, title); err != nil {
				s.log.Warn("screenshot capture/upload failed", "error", err)
			}

		case <-s.updateTicker.C:
			if err := s.autoupdate.CheckAndApply(ctx); err != nil {
				s.log.Warn("auto-update check failed", "error", err)
			}
		}
	}
}

// CaptureLoginScreenshot fires the "one screenshot on login" requirement,
// independent of the interval ticker (which starts counting from here).
func (s *Scheduler) CaptureLoginScreenshot(ctx context.Context) {
	session := s.auth.CurrentSession()
	if session == nil {
		return
	}
	app, title, _ := s.tracking.CurrentWindow()
	if err := s.screenshot.CaptureAndUpload(ctx, session, s.sessionID, s.config.ScreenshotQuality, 100, app, title); err != nil {
		s.log.Warn("login screenshot failed", "error", err)
	}
}

func (s *Scheduler) applyConfig(next domain.Config) {
	if next.HeartbeatIntervalSeconds == 0 {
		return // zero value means "heartbeat call failed", not "use zero interval"
	}
	if next.HeartbeatIntervalSeconds != s.config.HeartbeatIntervalSeconds {
		s.heartbeatTicker.Reset(time.Duration(next.HeartbeatIntervalSeconds) * time.Second)
	}
	if next.ScreenshotIntervalSeconds != s.config.ScreenshotIntervalSeconds {
		s.screenshotTicker.Reset(time.Duration(next.ScreenshotIntervalSeconds) * time.Second)
	}
	s.config = next
}
