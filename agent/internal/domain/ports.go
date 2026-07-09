package domain

import (
	"context"
	"time"
)

// APIGateway is the only way application code talks to the backend.
// The infrastructure/api package implements this over HTTPS+JWT.
type APIGateway interface {
	LoginEmployee(ctx context.Context, email, password string, device Device) (LoginResult, error)
	RefreshToken(ctx context.Context, refreshToken string) (TokenPair, error)
	StartSession(ctx context.Context, accessToken, deviceID string) (Session, error)
	EndSession(ctx context.Context, accessToken, sessionID, reason string) error
	Heartbeat(ctx context.Context, accessToken, sessionID string, input HeartbeatInput) (Config, error)
	SubmitActivityBatch(ctx context.Context, accessToken, deviceID string, samples []ActivitySample) (int, error)
	RequestScreenshotUploadURL(ctx context.Context, accessToken string, req UploadURLRequest) (UploadURLResponse, error)
	UploadScreenshot(ctx context.Context, uploadURL string, jpegBytes []byte) error
	ConfirmScreenshot(ctx context.Context, accessToken, screenshotID string) error
	LatestVersion(ctx context.Context, platform string) (VersionInfo, error)
}

type LoginResult struct {
	Tokens   TokenPair
	Device   Device
	Employee EmployeeIdentity
}

type EmployeeIdentity struct {
	ID       string
	FullName string
	Email    string
}

type TokenPair struct {
	AccessToken  string
	RefreshToken string
	ExpiresIn    int
}

type UploadURLRequest struct {
	SessionID       string
	CapturedAt      time.Time
	ActivityPercent int
	AppName         string
	WindowTitle     string
	FileSizeBytes   int
}

type UploadURLResponse struct {
	ScreenshotID string
	UploadURL    string
	StorageKey   string
	ExpiresIn    int
}

type VersionInfo struct {
	Version        string
	DownloadURL    string
	ChecksumSHA256 string
	IsMandatory    bool
}

// LocalQueue is the durable offline buffer (SQLite-backed in production).
type LocalQueue interface {
	EnqueueActivity(sample ActivitySample) error
	DequeueActivityBatch(max int) ([]ActivitySample, []int64, error)
	DeleteActivity(ids []int64) error

	EnqueueScreenshot(shot Screenshot) error
	DequeuePendingScreenshots(max int) ([]Screenshot, error)
	MarkScreenshotUploaded(id string) error
	DeleteScreenshot(id string) error

	Close() error
}

// WindowInspector reports the foreground application/window. Implemented
// per-OS in infrastructure/platform/{windows,linux}.
type WindowInspector interface {
	ActiveWindow() (appName string, windowTitle string, err error)
}

// IdleDetector reports how long the user has been idle.
type IdleDetector interface {
	IdleSeconds() (int, error)
}

// ScreenshotCapturer captures the current desktop and returns JPEG bytes
// already downscaled/compressed at the given quality (1-100).
type ScreenshotCapturer interface {
	Capture(quality int) (jpegBytes []byte, err error)
}

// SystemInfo reports OS-level facts the heartbeat needs.
type SystemInfo interface {
	UptimeSeconds() (int, error)
}

// TempFileStore persists a screenshot's bytes to a local scratch file when
// it can't be uploaded immediately, and cleans it up once queued/uploaded.
type TempFileStore interface {
	Write(jpegBytes []byte) (path string, err error)
	Remove(path string) error
}

// IDGenerator produces the screenshot IDs the agent assigns to queued
// captures before the backend has issued one via the upload-url response.
type IDGenerator interface {
	NewID() string
}

// CredentialStore persists the refresh token using OS-native protected
// storage (DPAPI on Windows, keyring/libsecret on Linux).
type CredentialStore interface {
	SaveRefreshToken(token string) error
	LoadRefreshToken() (string, bool, error)
	Clear() error
}

// ServiceController lets the updater request a safe restart of the
// OS-level service (Windows Service / systemd unit) once a new binary
// has been staged.
type ServiceController interface {
	RestartWithBinary(path string) error
}
