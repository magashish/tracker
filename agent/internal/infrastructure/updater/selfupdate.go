// Package updater implements application.Downloader and
// application.Updater: fetching a new agent binary and staging it into a
// versioned directory for the platform-specific ServiceController to
// swap in.
package updater

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"sync/atomic"
	"time"
)

func binaryName() string {
	if runtime.GOOS == "windows" {
		return "tracker-agent.exe"
	}
	return "tracker-agent"
}

type HTTPDownloader struct {
	client *http.Client
}

func NewHTTPDownloader() *HTTPDownloader {
	return &HTTPDownloader{client: &http.Client{Timeout: 5 * time.Minute}}
}

func (d *HTTPDownloader) Download(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("build download request: %w", err)
	}
	resp, err := d.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download update artifact: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("download update artifact: unexpected status %d", resp.StatusCode)
	}
	return io.ReadAll(resp.Body)
}

// VersionedStager writes each downloaded binary into its own timestamped
// subdirectory under versionsDir, so the currently-running binary is
// never overwritten while it's still executing.
type VersionedStager struct {
	versionsDir string
	inFlight    atomic.Int32 // incremented while a capture/upload is running
}

func NewVersionedStager(versionsDir string) (*VersionedStager, error) {
	if err := os.MkdirAll(versionsDir, 0o755); err != nil {
		return nil, fmt.Errorf("create versions dir %s: %w", versionsDir, err)
	}
	return &VersionedStager{versionsDir: versionsDir}, nil
}

func (s *VersionedStager) Stage(binary []byte) (string, error) {
	dir := filepath.Join(s.versionsDir, time.Now().UTC().Format("20060102-150405"))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("create version dir: %w", err)
	}
	path := filepath.Join(dir, binaryName())
	if err := os.WriteFile(path, binary, 0o755); err != nil {
		return "", fmt.Errorf("write staged binary: %w", err)
	}
	return path, nil
}

func (s *VersionedStager) IsQuiescent() bool {
	return s.inFlight.Load() == 0
}

// BeginWork/EndWork let the scheduler mark capture/upload activity so an
// update is never applied mid-upload (see AutoUpdateUseCase.CheckAndApply).
func (s *VersionedStager) BeginWork() { s.inFlight.Add(1) }
func (s *VersionedStager) EndWork()   { s.inFlight.Add(-1) }
