// Package logging provides the agent's daily-rotating JSON logger.
package logging

import (
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/natefinch/lumberjack.v2"
)

// New returns a structured JSON logger that writes to dir/agent.log,
// rotated daily (or at 10MB, whichever comes first), gzip-compressed,
// keeping 14 days of history — matching the "daily rotating logs"
// requirement without needing a local syslog/journald dependency.
func New(dir string) (*slog.Logger, func() error, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, nil, err
	}

	writer := &lumberjack.Logger{
		Filename:   filepath.Join(dir, "agent.log"),
		MaxSize:    10, // MB: lumberjack's own trigger, in case a day is unusually chatty
		MaxAge:     14, // days
		MaxBackups: 14,
		Compress:   true,
	}
	stopDailyRotation := startDailyRotation(writer)

	handler := slog.NewJSONHandler(writer, &slog.HandlerOptions{Level: slog.LevelInfo})
	logger := slog.New(handler)
	closeFn := func() error {
		stopDailyRotation()
		return writer.Close()
	}
	return logger, closeFn, nil
}

// startDailyRotation forces a rotation at the next local midnight and every
// 24h after, independent of lumberjack's own size-based trigger.
func startDailyRotation(writer *lumberjack.Logger) func() {
	stop := make(chan struct{})
	go func() {
		now := time.Now()
		nextMidnight := time.Date(now.Year(), now.Month(), now.Day()+1, 0, 0, 0, 0, now.Location())
		timer := time.NewTimer(time.Until(nextMidnight))
		defer timer.Stop()

		for {
			select {
			case <-stop:
				return
			case <-timer.C:
				_ = writer.Rotate()
				timer.Reset(24 * time.Hour)
			}
		}
	}()
	return func() { close(stop) }
}
