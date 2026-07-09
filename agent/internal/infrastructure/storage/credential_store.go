package storage

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// FileCredentialStore is the default CredentialStore: the refresh token is
// AES-GCM encrypted with a key derived from a locally-generated key file
// (0600 perms), then written to disk (also 0600). This is the documented
// fallback path in docs/architecture/05-desktop-agent-architecture.md for
// environments without a usable OS keyring/DPAPI — production Windows and
// Linux-with-keyring builds should prefer a DPAPI- or
// libsecret/kernel-keyring-backed implementation of the same
// domain.CredentialStore interface; this one is deliberately
// dependency-free so the agent keeps working headless (e.g. a server-side
// Linux install with no session keyring/D-Bus).
type FileCredentialStore struct {
	tokenPath string
	keyPath   string
}

func NewFileCredentialStore(dir string) (*FileCredentialStore, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("create credential dir %s: %w", dir, err)
	}
	return &FileCredentialStore{
		tokenPath: filepath.Join(dir, "refresh_token.enc"),
		keyPath:   filepath.Join(dir, "local.key"),
	}, nil
}

func (s *FileCredentialStore) SaveRefreshToken(token string) error {
	key, err := s.loadOrCreateKey()
	if err != nil {
		return err
	}
	ciphertext, err := encrypt(key, []byte(token))
	if err != nil {
		return fmt.Errorf("encrypt refresh token: %w", err)
	}
	if err := os.WriteFile(s.tokenPath, ciphertext, 0o600); err != nil {
		return fmt.Errorf("write refresh token: %w", err)
	}
	return nil
}

func (s *FileCredentialStore) LoadRefreshToken() (string, bool, error) {
	ciphertext, err := os.ReadFile(s.tokenPath)
	if os.IsNotExist(err) {
		return "", false, nil
	}
	if err != nil {
		return "", false, fmt.Errorf("read refresh token: %w", err)
	}
	key, err := s.loadOrCreateKey()
	if err != nil {
		return "", false, err
	}
	plaintext, err := decrypt(key, ciphertext)
	if err != nil {
		return "", false, fmt.Errorf("decrypt refresh token: %w", err)
	}
	return string(plaintext), true, nil
}

func (s *FileCredentialStore) Clear() error {
	if err := os.Remove(s.tokenPath); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("remove refresh token: %w", err)
	}
	return nil
}

func (s *FileCredentialStore) loadOrCreateKey() ([]byte, error) {
	raw, err := os.ReadFile(s.keyPath)
	if err == nil {
		sum := sha256.Sum256(raw)
		return sum[:], nil
	}
	if !os.IsNotExist(err) {
		return nil, fmt.Errorf("read key file: %w", err)
	}

	raw = make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return nil, fmt.Errorf("generate key: %w", err)
	}
	if err := os.WriteFile(s.keyPath, raw, 0o600); err != nil {
		return nil, fmt.Errorf("write key file: %w", err)
	}
	sum := sha256.Sum256(raw)
	return sum[:], nil
}

func encrypt(key, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}
	ciphertext := gcm.Seal(nonce, nonce, plaintext, nil)
	encoded := make([]byte, base64.StdEncoding.EncodedLen(len(ciphertext)))
	base64.StdEncoding.Encode(encoded, ciphertext)
	return encoded, nil
}

func decrypt(key, encoded []byte) ([]byte, error) {
	ciphertext := make([]byte, base64.StdEncoding.DecodedLen(len(encoded)))
	n, err := base64.StdEncoding.Decode(ciphertext, encoded)
	if err != nil {
		return nil, err
	}
	ciphertext = ciphertext[:n]

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(ciphertext) < gcm.NonceSize() {
		return nil, fmt.Errorf("ciphertext too short")
	}
	nonce, data := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]
	return gcm.Open(nil, nonce, data, nil)
}
