package application

import (
	"context"
	"fmt"
	"time"

	"github.com/tracker/agent/internal/domain"
)

// HeartbeatUseCase sends the periodic heartbeat and, on success, flushes
// the aggregated activity sample for the same window. On failure it hands
// the sample to the offline queue instead so no tracking data is lost.
type HeartbeatUseCase struct {
	api      domain.APIGateway
	sysInfo  domain.SystemInfo
	tracking *ActivityTrackingUseCase
	queue    domain.LocalQueue
}

func NewHeartbeatUseCase(
	api domain.APIGateway,
	sysInfo domain.SystemInfo,
	tracking *ActivityTrackingUseCase,
	queue domain.LocalQueue,
) *HeartbeatUseCase {
	return &HeartbeatUseCase{api: api, sysInfo: sysInfo, tracking: tracking, queue: queue}
}

func (u *HeartbeatUseCase) Execute(ctx context.Context, session *Session, sessionID string, windowStart, windowEnd time.Time) (domain.Config, error) {
	idleSeconds, err := u.tracking.CurrentIdleSeconds()
	if err != nil {
		return domain.Config{}, fmt.Errorf("read idle seconds: %w", err)
	}
	activeApp, activeTitle, err := u.tracking.CurrentWindow()
	if err != nil {
		return domain.Config{}, fmt.Errorf("read active window: %w", err)
	}
	uptime, err := u.sysInfo.UptimeSeconds()
	if err != nil {
		return domain.Config{}, fmt.Errorf("read system uptime: %w", err)
	}

	input := domain.HeartbeatInput{
		SessionID:           sessionID,
		CapturedAt:          windowEnd,
		IdleSeconds:         idleSeconds,
		SystemUptimeSeconds: uptime,
		ActiveApp:           activeApp,
		ActiveWindowTitle:   activeTitle,
	}

	config, err := u.api.Heartbeat(ctx, session.AccessToken, sessionID, input)
	sample, hasSample := u.tracking.Flush(windowStart, windowEnd)
	if hasSample {
		sample.SessionID = sessionID
	}

	if err != nil {
		// Offline (or the API call failed transiently): queue the
		// aggregated activity locally instead of dropping it.
		if hasSample {
			if qerr := u.queue.EnqueueActivity(sample); qerr != nil {
				return domain.Config{}, fmt.Errorf("heartbeat failed (%v) and queueing failed: %w", err, qerr)
			}
		}
		return domain.Config{}, err
	}

	return config, nil
}
