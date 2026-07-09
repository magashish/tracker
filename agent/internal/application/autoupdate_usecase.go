package application

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"

	"github.com/tracker/agent/internal/domain"
)

// Downloader fetches an update artifact's bytes from a URL.
type Downloader interface {
	Download(ctx context.Context, url string) ([]byte, error)
}

// Updater stages a downloaded, checksum-verified binary and restarts the
// OS service pointed at it.
type Updater interface {
	Stage(binary []byte) (path string, err error)
	IsQuiescent() bool // true when no capture/upload is in flight
}

type AutoUpdateUseCase struct {
	api        domain.APIGateway
	downloader Downloader
	updater    Updater
	controller domain.ServiceController
	platform   string
	currentVer string
}

func NewAutoUpdateUseCase(
	api domain.APIGateway,
	downloader Downloader,
	updater Updater,
	controller domain.ServiceController,
	platform, currentVersion string,
) *AutoUpdateUseCase {
	return &AutoUpdateUseCase{
		api:        api,
		downloader: downloader,
		updater:    updater,
		controller: controller,
		platform:   platform,
		currentVer: currentVersion,
	}
}

// CheckAndApply is safe to call on every tick; it no-ops unless a newer
// version is published and the agent is currently quiescent.
func (u *AutoUpdateUseCase) CheckAndApply(ctx context.Context) error {
	latest, err := u.api.LatestVersion(ctx, u.platform)
	if err != nil {
		return fmt.Errorf("check latest version: %w", err)
	}
	if latest.Version == u.currentVer {
		return nil
	}
	if !u.updater.IsQuiescent() {
		return nil // retry on a later tick rather than interrupting an in-flight upload
	}

	binary, err := u.downloader.Download(ctx, latest.DownloadURL)
	if err != nil {
		return fmt.Errorf("download update: %w", err)
	}

	sum := sha256.Sum256(binary)
	if hex.EncodeToString(sum[:]) != latest.ChecksumSHA256 {
		return fmt.Errorf("checksum mismatch for version %s: refusing to apply update", latest.Version)
	}

	stagedPath, err := u.updater.Stage(binary)
	if err != nil {
		return fmt.Errorf("stage update binary: %w", err)
	}

	if err := u.controller.RestartWithBinary(stagedPath); err != nil {
		return fmt.Errorf("restart service with new binary: %w", err)
	}
	return nil
}
