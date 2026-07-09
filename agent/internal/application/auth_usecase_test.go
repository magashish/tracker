package application_test

import (
	"context"
	"errors"
	"testing"

	"github.com/tracker/agent/internal/application"
	"github.com/tracker/agent/internal/domain"
)

type fakeAPIGateway struct {
	domain.APIGateway // embed so unused methods panic loudly if ever called
	loginResult       domain.LoginResult
	loginErr          error
	refreshResult     domain.TokenPair
	refreshErr        error
}

func (f *fakeAPIGateway) LoginEmployee(_ context.Context, _, _ string, _ domain.Device) (domain.LoginResult, error) {
	return f.loginResult, f.loginErr
}

func (f *fakeAPIGateway) RefreshToken(_ context.Context, _ string) (domain.TokenPair, error) {
	return f.refreshResult, f.refreshErr
}

type fakeCredentialStore struct {
	saved string
	ok    bool
}

func (f *fakeCredentialStore) SaveRefreshToken(token string) error {
	f.saved = token
	f.ok = true
	return nil
}
func (f *fakeCredentialStore) LoadRefreshToken() (string, bool, error) { return f.saved, f.ok, nil }
func (f *fakeCredentialStore) Clear() error {
	f.saved = ""
	f.ok = false
	return nil
}

func TestAuthUseCase_Login_PersistsRefreshToken(t *testing.T) {
	api := &fakeAPIGateway{
		loginResult: domain.LoginResult{
			Tokens: domain.TokenPair{AccessToken: "access-1", RefreshToken: "refresh-1", ExpiresIn: 900},
			Device: domain.Device{ID: "device-1"},
		},
	}
	creds := &fakeCredentialStore{}
	uc := application.NewAuthUseCase(api, creds)

	session, err := uc.Login(context.Background(), "jane@example.com", "password", domain.Device{DeviceUUID: "uuid-1"})
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if session.AccessToken != "access-1" {
		t.Errorf("AccessToken = %q, want %q", session.AccessToken, "access-1")
	}
	if creds.saved != "refresh-1" {
		t.Errorf("credential store saved %q, want %q", creds.saved, "refresh-1")
	}
	if uc.CurrentSession() != session {
		t.Errorf("CurrentSession() did not return the session set by Login()")
	}
}

func TestAuthUseCase_Login_PropagatesAPIError(t *testing.T) {
	api := &fakeAPIGateway{loginErr: errors.New("invalid credentials")}
	creds := &fakeCredentialStore{}
	uc := application.NewAuthUseCase(api, creds)

	_, err := uc.Login(context.Background(), "jane@example.com", "wrong", domain.Device{})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	if creds.ok {
		t.Errorf("credential store should not have saved anything on failed login")
	}
}

func TestAuthUseCase_ResumeFromStoredCredentials_ClearsInvalidToken(t *testing.T) {
	api := &fakeAPIGateway{refreshErr: errors.New("token expired")}
	creds := &fakeCredentialStore{saved: "stale-token", ok: true}
	uc := application.NewAuthUseCase(api, creds)

	session, err := uc.ResumeFromStoredCredentials(context.Background())
	if err != nil {
		t.Fatalf("ResumeFromStoredCredentials() error = %v, want nil (caller falls back to login)", err)
	}
	if session != nil {
		t.Errorf("expected nil session on invalid token, got %+v", session)
	}
	if creds.ok {
		t.Errorf("expected stale token to be cleared")
	}
}

func TestAuthUseCase_ResumeFromStoredCredentials_NoStoredToken(t *testing.T) {
	api := &fakeAPIGateway{}
	creds := &fakeCredentialStore{}
	uc := application.NewAuthUseCase(api, creds)

	session, err := uc.ResumeFromStoredCredentials(context.Background())
	if err != nil || session != nil {
		t.Fatalf("expected (nil, nil) when no token stored, got (%+v, %v)", session, err)
	}
}
