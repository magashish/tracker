// Package storage implements the agent's durable offline queue with a
// local SQLite database (modernc.org/sqlite: pure Go, no cgo, so the
// agent stays a single static binary).
package storage

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"

	"github.com/tracker/agent/internal/domain"
)

const schema = `
CREATE TABLE IF NOT EXISTS activity_queue (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	session_id TEXT NOT NULL,
	window_start TEXT NOT NULL,
	window_end TEXT NOT NULL,
	app_name TEXT NOT NULL,
	window_title TEXT,
	active_seconds INTEGER NOT NULL,
	idle_seconds INTEGER NOT NULL,
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS screenshot_queue (
	id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL,
	local_path TEXT NOT NULL,
	captured_at TEXT NOT NULL,
	activity_percent INTEGER NOT NULL,
	app_name TEXT,
	window_title TEXT,
	file_size_bytes INTEGER NOT NULL,
	upload_state TEXT NOT NULL DEFAULT 'pending',
	created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`

type SQLiteQueue struct {
	db *sql.DB
}

func NewSQLiteQueue(path string) (*SQLiteQueue, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("open sqlite queue at %s: %w", path, err)
	}
	db.SetMaxOpenConns(1) // sqlite file: avoid concurrent-writer lock errors

	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("apply queue schema: %w", err)
	}
	return &SQLiteQueue{db: db}, nil
}

func (q *SQLiteQueue) Close() error {
	return q.db.Close()
}

func (q *SQLiteQueue) EnqueueActivity(sample domain.ActivitySample) error {
	_, err := q.db.Exec(
		`INSERT INTO activity_queue (session_id, window_start, window_end, app_name, window_title, active_seconds, idle_seconds)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		sample.SessionID, sample.WindowStart.Format(time.RFC3339), sample.WindowEnd.Format(time.RFC3339),
		sample.AppName, sample.WindowTitle, sample.ActiveSeconds, sample.IdleSeconds,
	)
	if err != nil {
		return fmt.Errorf("enqueue activity: %w", err)
	}
	return nil
}

func (q *SQLiteQueue) DequeueActivityBatch(max int) ([]domain.ActivitySample, []int64, error) {
	rows, err := q.db.Query(
		`SELECT id, session_id, window_start, window_end, app_name, window_title, active_seconds, idle_seconds
		 FROM activity_queue ORDER BY id ASC LIMIT ?`, max,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("query activity queue: %w", err)
	}
	defer rows.Close()

	var samples []domain.ActivitySample
	var ids []int64
	for rows.Next() {
		var id int64
		var s domain.ActivitySample
		var windowStart, windowEnd string
		if err := rows.Scan(&id, &s.SessionID, &windowStart, &windowEnd, &s.AppName, &s.WindowTitle, &s.ActiveSeconds, &s.IdleSeconds); err != nil {
			return nil, nil, fmt.Errorf("scan activity queue row: %w", err)
		}
		s.WindowStart, _ = time.Parse(time.RFC3339, windowStart)
		s.WindowEnd, _ = time.Parse(time.RFC3339, windowEnd)
		samples = append(samples, s)
		ids = append(ids, id)
	}
	return samples, ids, rows.Err()
}

func (q *SQLiteQueue) DeleteActivity(ids []int64) error {
	tx, err := q.db.Begin()
	if err != nil {
		return fmt.Errorf("begin delete activity tx: %w", err)
	}
	stmt, err := tx.Prepare(`DELETE FROM activity_queue WHERE id = ?`)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("prepare delete activity: %w", err)
	}
	defer stmt.Close()
	for _, id := range ids {
		if _, err := stmt.Exec(id); err != nil {
			tx.Rollback()
			return fmt.Errorf("delete activity id=%d: %w", id, err)
		}
	}
	return tx.Commit()
}

func (q *SQLiteQueue) EnqueueScreenshot(shot domain.Screenshot) error {
	_, err := q.db.Exec(
		`INSERT INTO screenshot_queue (id, session_id, local_path, captured_at, activity_percent, app_name, window_title, file_size_bytes, upload_state)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		shot.ID, shot.SessionID, shot.LocalPath, shot.CapturedAt.Format(time.RFC3339),
		shot.ActivityPercent, shot.AppName, shot.WindowTitle, shot.FileSizeBytes, string(domain.UploadStatePending),
	)
	if err != nil {
		return fmt.Errorf("enqueue screenshot: %w", err)
	}
	return nil
}

func (q *SQLiteQueue) DequeuePendingScreenshots(max int) ([]domain.Screenshot, error) {
	rows, err := q.db.Query(
		`SELECT id, session_id, local_path, captured_at, activity_percent, app_name, window_title, file_size_bytes
		 FROM screenshot_queue WHERE upload_state = 'pending' ORDER BY created_at ASC LIMIT ?`, max,
	)
	if err != nil {
		return nil, fmt.Errorf("query screenshot queue: %w", err)
	}
	defer rows.Close()

	var shots []domain.Screenshot
	for rows.Next() {
		var shot domain.Screenshot
		var capturedAt string
		if err := rows.Scan(&shot.ID, &shot.SessionID, &shot.LocalPath, &capturedAt, &shot.ActivityPercent, &shot.AppName, &shot.WindowTitle, &shot.FileSizeBytes); err != nil {
			return nil, fmt.Errorf("scan screenshot queue row: %w", err)
		}
		shot.CapturedAt, _ = time.Parse(time.RFC3339, capturedAt)
		shot.UploadState = domain.UploadStatePending
		shots = append(shots, shot)
	}
	return shots, rows.Err()
}

func (q *SQLiteQueue) MarkScreenshotUploaded(id string) error {
	_, err := q.db.Exec(`UPDATE screenshot_queue SET upload_state = 'uploaded' WHERE id = ?`, id)
	return err
}

func (q *SQLiteQueue) DeleteScreenshot(id string) error {
	_, err := q.db.Exec(`DELETE FROM screenshot_queue WHERE id = ?`, id)
	return err
}
