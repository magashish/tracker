package application

import (
	"context"
	"fmt"

	"github.com/tracker/agent/internal/domain"
)

// AuthUseCase handles employee login and keeps the in-memory session
// (access token, device, employee identity) that the rest of the agent
// reads via CurrentSession().
type AuthUseCase struct {
	api   domain.APIGateway
	creds domain.CredentialStore

	session *Session
}

type Session struct {
	AccessToken  string
	RefreshToken string
	Device       domain.Device
	Employee     domain.EmployeeIdentity
}

func NewAuthUseCase(api domain.APIGateway, creds domain.CredentialStore) *AuthUseCase {
	return &AuthUseCase{api: api, creds: creds}
}

// Login authenticates with the backend and registers the device in one call.
func (u *AuthUseCase) Login(ctx context.Context, email, password string, device domain.Device) (*Session, error) {
	result, err := u.api.LoginEmployee(ctx, email, password, device)
	if err != nil {
		return nil, fmt.Errorf("login: %w", err)
	}

	if err := u.creds.SaveRefreshToken(result.Tokens.RefreshToken); err != nil {
		return nil, fmt.Errorf("persist refresh token: %w", err)
	}

	u.session = &Session{
		AccessToken:  result.Tokens.AccessToken,
		RefreshToken: result.Tokens.RefreshToken,
		Device:       result.Device,
		Employee:     result.Employee,
	}
	return u.session, nil
}

// ResumeFromStoredCredentials tries to skip the login screen using a
// previously saved refresh token (the common path on service restart).
func (u *AuthUseCase) ResumeFromStoredCredentials(ctx context.Context) (*Session, error) {
	token, ok, err := u.creds.LoadRefreshToken()
	if err != nil || !ok {
		return nil, err
	}

	tokens, err := u.api.RefreshToken(ctx, token)
	if err != nil {
		// Stored token is no longer valid; caller falls back to the login screen.
		_ = u.creds.Clear()
		return nil, nil
	}

	if err := u.creds.SaveRefreshToken(tokens.RefreshToken); err != nil {
		return nil, err
	}

	u.session = &Session{AccessToken: tokens.AccessToken, RefreshToken: tokens.RefreshToken}
	return u.session, nil
}

func (u *AuthUseCase) RefreshAccessToken(ctx context.Context) error {
	if u.session == nil {
		return fmt.Errorf("no active session")
	}
	tokens, err := u.api.RefreshToken(ctx, u.session.RefreshToken)
	if err != nil {
		return fmt.Errorf("refresh access token: %w", err)
	}
	u.session.AccessToken = tokens.AccessToken
	u.session.RefreshToken = tokens.RefreshToken
	return u.creds.SaveRefreshToken(tokens.RefreshToken)
}

func (u *AuthUseCase) Logout() error {
	u.session = nil
	return u.creds.Clear()
}

func (u *AuthUseCase) CurrentSession() *Session {
	return u.session
}
