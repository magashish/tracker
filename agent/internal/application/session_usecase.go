package application

import (
	"context"
	"fmt"

	"github.com/tracker/agent/internal/domain"
)

type SessionUseCase struct {
	api domain.APIGateway
}

func NewSessionUseCase(api domain.APIGateway) *SessionUseCase {
	return &SessionUseCase{api: api}
}

func (u *SessionUseCase) Start(ctx context.Context, session *Session) (domain.Session, error) {
	s, err := u.api.StartSession(ctx, session.AccessToken, session.Device.ID)
	if err != nil {
		return domain.Session{}, fmt.Errorf("start session: %w", err)
	}
	return s, nil
}

func (u *SessionUseCase) End(ctx context.Context, session *Session, sessionID, reason string) error {
	if err := u.api.EndSession(ctx, session.AccessToken, sessionID, reason); err != nil {
		return fmt.Errorf("end session: %w", err)
	}
	return nil
}
