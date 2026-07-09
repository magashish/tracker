// Package config resolves the agent's local configuration file (API URL,
// storage paths) and holds the last-known remote config overlay fetched
// from the backend (heartbeat/screenshot intervals, quality), so the
// agent keeps working with its last-known values while offline.
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/tracker/agent/internal/domain"
)

// LocalConfig is read once at startup from a JSON file next to the
// binary (or an OS-appropriate config dir); it never changes remotely —
// only the backend-controlled fields in domain.Config do.
type LocalConfig struct {
	APIURL       string `json:"apiUrl"`
	DataDir      string `json:"dataDir"`
	AgentVersion string `json:"-"`
}

const AgentVersion = "0.1.0"

func DefaultDataDir() string {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = os.TempDir()
	}
	return filepath.Join(dir, "tracker-agent")
}

func Load(path string) (LocalConfig, error) {
	cfg := LocalConfig{
		APIURL:  "https://api.tracker.example.com/api/v1",
		DataDir: DefaultDataDir(),
	}

	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		cfg.AgentVersion = AgentVersion
		return cfg, nil
	}
	if err != nil {
		return cfg, fmt.Errorf("read config file %s: %w", path, err)
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("parse config file %s: %w", path, err)
	}
	cfg.AgentVersion = AgentVersion
	return cfg, nil
}

// RemoteConfigCache persists the last-known effective config to disk so a
// restart while offline still has sane, previously-approved intervals
// instead of falling back to hardcoded defaults.
type RemoteConfigCache struct {
	path string
}

func NewRemoteConfigCache(dataDir string) *RemoteConfigCache {
	return &RemoteConfigCache{path: filepath.Join(dataDir, "remote_config.json")}
}

func (c *RemoteConfigCache) Load() domain.Config {
	data, err := os.ReadFile(c.path)
	if err != nil {
		return domain.DefaultConfig()
	}
	var cfg domain.Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return domain.DefaultConfig()
	}
	return cfg
}

func (c *RemoteConfigCache) Save(cfg domain.Config) error {
	data, err := json.Marshal(cfg)
	if err != nil {
		return err
	}
	return os.WriteFile(c.path, data, 0o600)
}
