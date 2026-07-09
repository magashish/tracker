package application

import (
	"context"
	"fmt"
	"time"

	"github.com/tracker/agent/internal/domain"
)

// ScreenshotUseCase captures, requests an upload slot, and uploads a
// screenshot. Capture is always synchronous and cheap; upload is the part
// that can fail/queue, so it is a separate step the scheduler can retry.
type ScreenshotUseCase struct {
	api      domain.APIGateway
	capture  domain.ScreenshotCapturer
	queue    domain.LocalQueue
	tempFile domain.TempFileStore
	ids      domain.IDGenerator
}

func NewScreenshotUseCase(
	api domain.APIGateway,
	capture domain.ScreenshotCapturer,
	queue domain.LocalQueue,
	tempFile domain.TempFileStore,
	ids domain.IDGenerator,
) *ScreenshotUseCase {
	return &ScreenshotUseCase{api: api, capture: capture, queue: queue, tempFile: tempFile, ids: ids}
}

// CaptureAndUpload takes a screenshot now and attempts to upload it
// immediately. On any failure (capture succeeded, upload didn't) the
// screenshot is queued for the sync use case to retry later.
func (u *ScreenshotUseCase) CaptureAndUpload(
	ctx context.Context,
	session *Session,
	sessionID string,
	quality int,
	activityPercent int,
	appName, windowTitle string,
) error {
	jpegBytes, err := u.capture.Capture(quality)
	if err != nil {
		return fmt.Errorf("capture screenshot: %w", err)
	}

	capturedAt := time.Now().UTC()
	req := domain.UploadURLRequest{
		SessionID:       sessionID,
		CapturedAt:      capturedAt,
		ActivityPercent: activityPercent,
		AppName:         appName,
		WindowTitle:     windowTitle,
		FileSizeBytes:   len(jpegBytes),
	}

	resp, err := u.api.RequestScreenshotUploadURL(ctx, session.AccessToken, req)
	if err != nil {
		return u.enqueueForLater(capturedAt, jpegBytes, appName, windowTitle, activityPercent, sessionID)
	}

	if err := u.api.UploadScreenshot(ctx, resp.UploadURL, jpegBytes); err != nil {
		return u.enqueueForLater(capturedAt, jpegBytes, appName, windowTitle, activityPercent, sessionID)
	}

	if err := u.api.ConfirmScreenshot(ctx, session.AccessToken, resp.ScreenshotID); err != nil {
		// Upload itself succeeded; a failed confirm is not worth re-queueing
		// the whole capture for (it would just double-upload). Log and move on.
		return fmt.Errorf("confirm screenshot: %w", err)
	}

	return nil
}

func (u *ScreenshotUseCase) enqueueForLater(capturedAt time.Time, jpegBytes []byte, appName, windowTitle string, activityPercent int, sessionID string) error {
	localPath, err := u.tempFile.Write(jpegBytes)
	if err != nil {
		return fmt.Errorf("persist screenshot to local temp file: %w", err)
	}
	shot := domain.Screenshot{
		ID:              u.ids.NewID(),
		SessionID:       sessionID,
		LocalPath:       localPath,
		CapturedAt:      capturedAt,
		ActivityPercent: activityPercent,
		AppName:         appName,
		WindowTitle:     windowTitle,
		FileSizeBytes:   len(jpegBytes),
		UploadState:     domain.UploadStatePending,
	}
	return u.queue.EnqueueScreenshot(shot)
}
