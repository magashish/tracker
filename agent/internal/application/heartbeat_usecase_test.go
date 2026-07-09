package application_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/tracker/agent/internal/application"
	"github.com/tracker/agent/internal/domain"
)

type fakeWindowInspector struct {
	app, title string
	err        error
}

func (f *fakeWindowInspector) ActiveWindow() (string, string, error) { return f.app, f.title, f.err }

type fakeIdleDetector struct {
	seconds int
	err     error
}

func (f *fakeIdleDetector) IdleSeconds() (int, error) { return f.seconds, f.err }

type fakeSystemInfo struct{ uptime int }

func (f *fakeSystemInfo) UptimeSeconds() (int, error) { return f.uptime, nil }

type fakeQueue struct {
	domain.LocalQueue
	enqueued []domain.ActivitySample
}

func (f *fakeQueue) EnqueueActivity(sample domain.ActivitySample) error {
	f.enqueued = append(f.enqueued, sample)
	return nil
}

type heartbeatOnlyGateway struct {
	fakeAPIGateway
	heartbeatErr error
	config       domain.Config
	lastInput    domain.HeartbeatInput
}

func (g *heartbeatOnlyGateway) Heartbeat(_ context.Context, _, _ string, input domain.HeartbeatInput) (domain.Config, error) {
	g.lastInput = input
	if g.heartbeatErr != nil {
		return domain.Config{}, g.heartbeatErr
	}
	return g.config, nil
}

func TestHeartbeatUseCase_Success_ReturnsConfig(t *testing.T) {
	api := &heartbeatOnlyGateway{config: domain.Config{HeartbeatIntervalSeconds: 45}}
	windows := &fakeWindowInspector{app: "code", title: "main.go"}
	idle := &fakeIdleDetector{seconds: 5}
	tracking := application.NewActivityTrackingUseCase(windows, idle)
	uc := application.NewHeartbeatUseCase(api, &fakeSystemInfo{uptime: 1234}, tracking, &fakeQueue{})

	session := &application.Session{AccessToken: "token"}
	windowStart := time.Now().Add(-30 * time.Second)
	windowEnd := time.Now()

	config, err := uc.Execute(context.Background(), session, "session-1", windowStart, windowEnd)
	if err != nil {
		t.Fatalf("Execute() error = %v", err)
	}
	if config.HeartbeatIntervalSeconds != 45 {
		t.Errorf("HeartbeatIntervalSeconds = %d, want 45", config.HeartbeatIntervalSeconds)
	}
	if api.lastInput.ActiveApp != "code" || api.lastInput.IdleSeconds != 5 {
		t.Errorf("heartbeat sent unexpected input: %+v", api.lastInput)
	}
}

func TestHeartbeatUseCase_OfflineFailure_QueuesActivity(t *testing.T) {
	api := &heartbeatOnlyGateway{heartbeatErr: errors.New("network unreachable")}
	windows := &fakeWindowInspector{app: "chrome", title: "Gmail"}
	idle := &fakeIdleDetector{seconds: 0}
	tracking := application.NewActivityTrackingUseCase(windows, idle)
	queue := &fakeQueue{}
	uc := application.NewHeartbeatUseCase(api, &fakeSystemInfo{}, tracking, queue)

	// Sample once so Flush() has something to hand to the queue.
	if err := tracking.Sample(30*time.Second, 300); err != nil {
		t.Fatalf("Sample() error = %v", err)
	}

	session := &application.Session{AccessToken: "token"}
	_, err := uc.Execute(context.Background(), session, "session-1", time.Now().Add(-30*time.Second), time.Now())
	if err == nil {
		t.Fatal("expected heartbeat to return the network error")
	}
	if len(queue.enqueued) != 1 {
		t.Fatalf("expected 1 queued activity sample, got %d", len(queue.enqueued))
	}
	if queue.enqueued[0].SessionID != "session-1" {
		t.Errorf("queued sample has wrong session ID: %+v", queue.enqueued[0])
	}
}
