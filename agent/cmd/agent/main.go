// Command agent is the Tracker desktop agent's composition root: it wires
// concrete infrastructure (HTTP client, SQLite queue, OS-specific platform
// adapters) into the application use cases via constructor injection, per
// docs/architecture/05-desktop-agent-architecture.md §5.3. No business
// logic lives in this file — only wiring and the top-level run loop.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"syscall"
	"time"

	"github.com/google/uuid"

	"github.com/tracker/agent/internal/application"
	agentconfig "github.com/tracker/agent/internal/config"
	"github.com/tracker/agent/internal/domain"
	"github.com/tracker/agent/internal/infrastructure/api"
	"github.com/tracker/agent/internal/infrastructure/logging"
	"github.com/tracker/agent/internal/infrastructure/storage"
	"github.com/tracker/agent/internal/infrastructure/updater"
	"github.com/tracker/agent/internal/interfaces/loginui"
)

func main() {
	runService(run)
}

func run(ctx context.Context) {
	localCfg, err := agentconfig.Load(configFilePath())
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to load local config:", err)
		os.Exit(1)
	}

	log, closeLog, err := logging.New(filepath.Join(localCfg.DataDir, "logs"))
	if err != nil {
		fmt.Fprintln(os.Stderr, "failed to init logger:", err)
		os.Exit(1)
	}
	defer closeLog()
	log.Info("agent starting", "version", localCfg.AgentVersion, "os", runtime.GOOS)

	ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()

	apiClient := api.NewClient(localCfg.APIURL)

	credStore, err := storage.NewFileCredentialStore(filepath.Join(localCfg.DataDir, "credentials"))
	if err != nil {
		log.Error("failed to init credential store", "error", err)
		os.Exit(1)
	}

	queue, err := storage.NewSQLiteQueue(filepath.Join(localCfg.DataDir, "queue.db"))
	if err != nil {
		log.Error("failed to init offline queue", "error", err)
		os.Exit(1)
	}
	defer queue.Close()

	tempFiles, err := storage.NewTempFileStore(filepath.Join(localCfg.DataDir, "pending-screenshots"))
	if err != nil {
		log.Error("failed to init temp screenshot store", "error", err)
		os.Exit(1)
	}

	platform := newPlatformAdapters(localCfg.DataDir)
	stager, err := updater.NewVersionedStager(filepath.Join(localCfg.DataDir, "versions"))
	if err != nil {
		log.Error("failed to init updater staging dir", "error", err)
		os.Exit(1)
	}

	authUC := application.NewAuthUseCase(apiClient, credStore)
	tracking := application.NewActivityTrackingUseCase(platform.Windows, platform.Idle)
	heartbeatUC := application.NewHeartbeatUseCase(apiClient, platform.SysInfo, tracking, queue)
	screenshotUC := application.NewScreenshotUseCase(apiClient, platform.Screenshot, queue, tempFiles, storage.UUIDGenerator{})
	syncUC := application.NewSyncUseCase(apiClient, queue, tempFiles)
	sessionUC := application.NewSessionUseCase(apiClient)
	autoupdateUC := application.NewAutoUpdateUseCase(apiClient, updater.NewHTTPDownloader(), stager, platform.Service, runtime.GOOS, localCfg.AgentVersion)

	session, err := authenticate(ctx, authUC, localCfg, log)
	if err != nil || session == nil {
		log.Error("authentication failed, exiting", "error", err)
		os.Exit(1)
	}

	remoteConfigCache := agentconfig.NewRemoteConfigCache(localCfg.DataDir)
	effectiveConfig := remoteConfigCache.Load()

	domainSession, err := sessionUC.Start(ctx, session)
	if err != nil {
		log.Error("failed to start session", "error", err)
		os.Exit(1)
	}
	log.Info("session started", "sessionId", domainSession.ID)

	scheduler := application.NewScheduler(authUC, tracking, heartbeatUC, screenshotUC, syncUC, autoupdateUC, effectiveConfig, domainSession.ID, log)
	scheduler.CaptureLoginScreenshot(ctx)

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := sessionUC.End(shutdownCtx, session, domainSession.ID, "app_closed"); err != nil {
			log.Warn("failed to cleanly end session on shutdown", "error", err)
		}
	}()

	scheduler.Run(ctx)
	log.Info("agent stopped")
}

// authenticate first tries to resume a session from a stored refresh
// token (the common path on service restart); a resumed session still
// needs its Device identity, which the refresh call itself doesn't
// return, so that's restored from a small local device cache written on
// the last successful login. If either is missing, it falls back to the
// login prompt.
func authenticate(ctx context.Context, authUC *application.AuthUseCase, localCfg agentconfig.LocalConfig, log *slog.Logger) (*application.Session, error) {
	if session, err := authUC.ResumeFromStoredCredentials(ctx); err == nil && session != nil {
		if device, ok := loadCachedDevice(localCfg.DataDir); ok {
			session.Device = device
			log.Info("resumed session from stored refresh token", "deviceId", device.ID)
			return session, nil
		}
		log.Warn("stored refresh token valid but device cache missing; falling back to login")
	}

	prompter := loginui.NewCLIPrompter(os.Stdin, os.Stdout, int(os.Stdin.Fd()))
	for {
		creds, err := prompter.PromptLogin()
		if err != nil {
			return nil, err
		}
		device := domain.Device{
			DeviceUUID:   deviceUUID(localCfg.DataDir),
			Hostname:     hostname(),
			OS:           runtime.GOOS,
			AgentVersion: localCfg.AgentVersion,
		}
		session, err := authUC.Login(ctx, creds.Email, creds.Password, device)
		if err != nil {
			prompter.ShowError(err.Error())
			continue
		}
		if err := saveCachedDevice(localCfg.DataDir, session.Device); err != nil {
			log.Warn("failed to cache device identity for future resume", "error", err)
		}
		return session, nil
	}
}

func configFilePath() string {
	return filepath.Join(agentconfig.DefaultDataDir(), "config.json")
}

func hostname() string {
	name, err := os.Hostname()
	if err != nil {
		return "unknown-host"
	}
	return name
}

// deviceUUID is generated once per install and persisted, so the same
// physical machine always registers as the same device.
func deviceUUID(dataDir string) string {
	path := filepath.Join(dataDir, "device_uuid")
	if data, err := os.ReadFile(path); err == nil && len(data) > 0 {
		return string(data)
	}
	id := uuid.NewString()
	_ = os.MkdirAll(dataDir, 0o700)
	_ = os.WriteFile(path, []byte(id), 0o600)
	return id
}

func deviceCachePath(dataDir string) string {
	return filepath.Join(dataDir, "device_cache.json")
}

func saveCachedDevice(dataDir string, device domain.Device) error {
	data, err := json.Marshal(device)
	if err != nil {
		return err
	}
	return os.WriteFile(deviceCachePath(dataDir), data, 0o600)
}

func loadCachedDevice(dataDir string) (domain.Device, bool) {
	data, err := os.ReadFile(deviceCachePath(dataDir))
	if err != nil {
		return domain.Device{}, false
	}
	var device domain.Device
	if err := json.Unmarshal(data, &device); err != nil || device.ID == "" {
		return domain.Device{}, false
	}
	return device, true
}
