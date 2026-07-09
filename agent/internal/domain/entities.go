package domain

import "time"

type Device struct {
	ID           string
	DeviceUUID   string
	Hostname     string
	OS           string
	OSVersion    string
	AgentVersion string
}

type Session struct {
	ID        string
	StartedAt time.Time
}

type Config struct {
	HeartbeatIntervalSeconds  int
	ScreenshotIntervalSeconds int
	ScreenshotQuality         int
	IdleThresholdSeconds      int
	APIURL                    string
}

func DefaultConfig() Config {
	return Config{
		HeartbeatIntervalSeconds:  30,
		ScreenshotIntervalSeconds: 600,
		ScreenshotQuality:         70,
		IdleThresholdSeconds:      300,
	}
}

// ActivitySample is one aggregated window of active/idle app-usage,
// flushed to the API (or the offline queue) once per heartbeat tick.
type ActivitySample struct {
	SessionID     string
	WindowStart   time.Time
	WindowEnd     time.Time
	AppName       string
	WindowTitle   string
	ActiveSeconds int
	IdleSeconds   int
}

type HeartbeatInput struct {
	SessionID           string
	CapturedAt          time.Time
	IdleSeconds         int
	SystemUptimeSeconds int
	ActiveApp           string
	ActiveWindowTitle   string
}

type Screenshot struct {
	ID              string
	SessionID       string
	LocalPath       string
	CapturedAt      time.Time
	ActivityPercent int
	AppName         string
	WindowTitle     string
	FileSizeBytes   int
	UploadState     UploadState
}

type UploadState string

const (
	UploadStatePending   UploadState = "pending"
	UploadStateUploading UploadState = "uploading"
	UploadStateUploaded  UploadState = "uploaded"
)

// QueuedActivityBatch is a durable-queue row awaiting sync when the
// agent regains connectivity.
type QueuedActivityBatch struct {
	ID      int64
	Samples []ActivitySample
}
