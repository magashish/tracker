package storage_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/tracker/agent/internal/domain"
	"github.com/tracker/agent/internal/infrastructure/storage"
)

func TestSQLiteQueue_ActivityRoundTrip(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "queue.db")
	q, err := storage.NewSQLiteQueue(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteQueue() error = %v", err)
	}
	defer q.Close()

	sample := domain.ActivitySample{
		SessionID:     "session-1",
		WindowStart:   time.Now().Add(-30 * time.Second).UTC().Truncate(time.Second),
		WindowEnd:     time.Now().UTC().Truncate(time.Second),
		AppName:       "code",
		WindowTitle:   "main.go",
		ActiveSeconds: 25,
		IdleSeconds:   5,
	}
	if err := q.EnqueueActivity(sample); err != nil {
		t.Fatalf("EnqueueActivity() error = %v", err)
	}

	samples, ids, err := q.DequeueActivityBatch(10)
	if err != nil {
		t.Fatalf("DequeueActivityBatch() error = %v", err)
	}
	if len(samples) != 1 || len(ids) != 1 {
		t.Fatalf("expected 1 queued sample, got %d samples / %d ids", len(samples), len(ids))
	}
	if samples[0].AppName != "code" || samples[0].ActiveSeconds != 25 {
		t.Errorf("dequeued sample mismatch: %+v", samples[0])
	}

	if err := q.DeleteActivity(ids); err != nil {
		t.Fatalf("DeleteActivity() error = %v", err)
	}
	samples, _, err = q.DequeueActivityBatch(10)
	if err != nil {
		t.Fatalf("DequeueActivityBatch() after delete error = %v", err)
	}
	if len(samples) != 0 {
		t.Errorf("expected queue empty after delete, got %d samples", len(samples))
	}
}

func TestSQLiteQueue_ScreenshotRoundTrip(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "queue.db")
	q, err := storage.NewSQLiteQueue(dbPath)
	if err != nil {
		t.Fatalf("NewSQLiteQueue() error = %v", err)
	}
	defer q.Close()

	shot := domain.Screenshot{
		ID:              "shot-1",
		SessionID:       "session-1",
		LocalPath:       "/tmp/shot-1.jpg",
		CapturedAt:      time.Now().UTC().Truncate(time.Second),
		ActivityPercent: 80,
		AppName:         "chrome",
		WindowTitle:     "Gmail",
		FileSizeBytes:   1024,
	}
	if err := q.EnqueueScreenshot(shot); err != nil {
		t.Fatalf("EnqueueScreenshot() error = %v", err)
	}

	pending, err := q.DequeuePendingScreenshots(10)
	if err != nil {
		t.Fatalf("DequeuePendingScreenshots() error = %v", err)
	}
	if len(pending) != 1 || pending[0].ID != "shot-1" {
		t.Fatalf("expected 1 pending screenshot with id shot-1, got %+v", pending)
	}

	if err := q.DeleteScreenshot("shot-1"); err != nil {
		t.Fatalf("DeleteScreenshot() error = %v", err)
	}
	pending, err = q.DequeuePendingScreenshots(10)
	if err != nil {
		t.Fatalf("DequeuePendingScreenshots() after delete error = %v", err)
	}
	if len(pending) != 0 {
		t.Errorf("expected no pending screenshots after delete, got %d", len(pending))
	}
}
