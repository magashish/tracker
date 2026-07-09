package application

import (
	"context"
	"fmt"
	"os"

	"github.com/tracker/agent/internal/domain"
)

const (
	activityBatchSize   = 100
	screenshotBatchSize = 5
)

// SyncUseCase drains the offline queue whenever the agent is back online.
// It runs on every heartbeat tick; if the queue is empty this is a no-op.
type SyncUseCase struct {
	api      domain.APIGateway
	queue    domain.LocalQueue
	tempFile domain.TempFileStore
}

func NewSyncUseCase(api domain.APIGateway, queue domain.LocalQueue, tempFile domain.TempFileStore) *SyncUseCase {
	return &SyncUseCase{api: api, queue: queue, tempFile: tempFile}
}

func (u *SyncUseCase) DrainActivity(ctx context.Context, accessToken, deviceID string) (int, error) {
	samples, ids, err := u.queue.DequeueActivityBatch(activityBatchSize)
	if err != nil {
		return 0, fmt.Errorf("dequeue activity: %w", err)
	}
	if len(samples) == 0 {
		return 0, nil
	}

	accepted, err := u.api.SubmitActivityBatch(ctx, accessToken, deviceID, samples)
	if err != nil {
		return 0, fmt.Errorf("submit activity batch: %w", err)
	}
	if err := u.queue.DeleteActivity(ids); err != nil {
		return accepted, fmt.Errorf("delete synced activity from queue: %w", err)
	}
	return accepted, nil
}

func (u *SyncUseCase) DrainScreenshots(ctx context.Context, accessToken string) (int, error) {
	shots, err := u.queue.DequeuePendingScreenshots(screenshotBatchSize)
	if err != nil {
		return 0, fmt.Errorf("dequeue screenshots: %w", err)
	}

	synced := 0
	for _, shot := range shots {
		data, err := os.ReadFile(shot.LocalPath)
		if err != nil {
			_ = u.queue.DeleteScreenshot(shot.ID) // file gone; drop rather than retry forever
			continue
		}

		req := domain.UploadURLRequest{
			SessionID:       shot.SessionID,
			CapturedAt:      shot.CapturedAt,
			ActivityPercent: shot.ActivityPercent,
			AppName:         shot.AppName,
			WindowTitle:     shot.WindowTitle,
			FileSizeBytes:   shot.FileSizeBytes,
		}
		resp, err := u.api.RequestScreenshotUploadURL(ctx, accessToken, req)
		if err != nil {
			return synced, fmt.Errorf("request upload url: %w", err)
		}
		if err := u.api.UploadScreenshot(ctx, resp.UploadURL, data); err != nil {
			return synced, fmt.Errorf("upload screenshot: %w", err)
		}
		if err := u.api.ConfirmScreenshot(ctx, accessToken, resp.ScreenshotID); err != nil {
			return synced, fmt.Errorf("confirm screenshot: %w", err)
		}

		_ = u.queue.DeleteScreenshot(shot.ID)
		_ = u.tempFile.Remove(shot.LocalPath)
		synced++
	}
	return synced, nil
}
