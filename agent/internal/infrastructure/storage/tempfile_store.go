package storage

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/google/uuid"
)

type TempFileStore struct {
	dir string
}

func NewTempFileStore(dir string) (*TempFileStore, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("create temp screenshot dir %s: %w", dir, err)
	}
	return &TempFileStore{dir: dir}, nil
}

func (s *TempFileStore) Write(jpegBytes []byte) (string, error) {
	path := filepath.Join(s.dir, uuid.NewString()+".jpg")
	if err := os.WriteFile(path, jpegBytes, 0o600); err != nil {
		return "", fmt.Errorf("write temp screenshot: %w", err)
	}
	return path, nil
}

func (s *TempFileStore) Remove(path string) error {
	if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove temp screenshot: %w", err)
	}
	return nil
}

type UUIDGenerator struct{}

func (UUIDGenerator) NewID() string {
	return uuid.NewString()
}
